"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPusherClient } from "@/lib/pusher-client";
import type PusherClient from "pusher-js";
import type { Channel } from "pusher-js";

interface UsePusherOptions {
  /** Pusher channel name to subscribe to */
  channelName: string;
  /** Map of event names to the tRPC query keys that should be invalidated */
  eventQueryMap: Record<string, string[][]>;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Subscribes to a Pusher channel and invalidates React Query cache
 * entries when matching events are received.
 */
export function usePusher({
  channelName,
  eventQueryMap,
  enabled = true,
}: UsePusherOptions) {
  const queryClient = useQueryClient();
  const channelRef = useRef<Channel | null>(null);
  const pusherRef = useRef<PusherClient | null>(null);

  // Stabilise the map reference so the effect doesn't re-run on every render
  const stableMapKey = JSON.stringify(eventQueryMap);
  const stableEventQueryMap = useMemo(
    () => eventQueryMap,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableMapKey],
  );

  useEffect(() => {
    if (!enabled || !channelName) return;

    let client: PusherClient;
    try {
      client = getPusherClient();
    } catch {
      // Pusher env vars may not be configured
      return;
    }

    pusherRef.current = client;
    const channel = client.subscribe(channelName);
    channelRef.current = channel;

    // Bind each event to invalidate the corresponding query keys
    const eventNames = Object.keys(stableEventQueryMap);
    for (const eventName of eventNames) {
      channel.bind(eventName, () => {
        const queryKeys = stableEventQueryMap[eventName];
        if (!queryKeys) return;
        for (const key of queryKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      });
    }

    return () => {
      for (const eventName of eventNames) {
        channel.unbind(eventName);
      }
      client.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [channelName, stableEventQueryMap, enabled, queryClient]);
}

/** A single channel subscription config */
interface ChannelSubscription {
  /** Pusher channel name */
  channel: string;
  /** Map of event names to the tRPC query keys that should be invalidated */
  eventQueryMap: Record<string, string[][]>;
}

/**
 * Subscribe to multiple Pusher channels at once.
 * Each subscription maps events to tRPC query keys for cache invalidation.
 */
export function useMultiChannelPusher(
  subscriptions: ChannelSubscription[],
  enabled = true,
) {
  const queryClient = useQueryClient();

  // Stabilise subscriptions to avoid effect churn
  const stableKey = JSON.stringify(subscriptions);
  const stableSubs = useMemo(
    () => subscriptions,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableKey],
  );

  useEffect(() => {
    if (!enabled || stableSubs.length === 0) return;

    let client: PusherClient;
    try {
      client = getPusherClient();
    } catch {
      return;
    }

    const channels: Channel[] = [];
    const bindings: Array<{ channel: Channel; event: string }> = [];

    for (const sub of stableSubs) {
      const channel = client.subscribe(sub.channel);
      channels.push(channel);

      for (const eventName of Object.keys(sub.eventQueryMap)) {
        channel.bind(eventName, () => {
          const queryKeys = sub.eventQueryMap[eventName];
          if (!queryKeys) return;
          for (const key of queryKeys) {
            queryClient.invalidateQueries({ queryKey: key });
          }
        });
        bindings.push({ channel, event: eventName });
      }
    }

    return () => {
      for (const b of bindings) {
        b.channel.unbind(b.event);
      }
      for (const sub of stableSubs) {
        client.unsubscribe(sub.channel);
      }
    };
  }, [stableSubs, enabled, queryClient]);
}
