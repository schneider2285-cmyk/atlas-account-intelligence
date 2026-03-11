import { useCallback, useEffect, useMemo, useState } from "react";
import { AtlasPlatformService } from "../../application/atlasPlatformService";

const service = new AtlasPlatformService();

export function useAtlasPlatform({ accessToken = "", enabled = true, allowPersistence = true } = {}) {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async ({ refresh = false } = {}) => {
    if (!enabled) {
      setLoading(false);
      setWorkspace(null);
      setError("");
      return;
    }

    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");
    service.setAccessToken(accessToken);

    try {
      const result = await service.buildDailyWorkspace({
        date: new Date().toISOString(),
        allowPersistence
      });
      setWorkspace(result);
      if (allowPersistence && result.persistenceWarnings?.length) {
        setError(`Read-only mode: ${result.persistenceWarnings[0]}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Atlas workspace.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, enabled, allowPersistence]);

  useEffect(() => {
    load();
  }, [load]);

  const moveKanbanCard = useCallback(
    async (cardId, direction) => {
      if (!workspace) return;
      if (!allowPersistence) {
        setError("Your role is read-only. Ask an admin or manager to move outreach cards.");
        return;
      }

      try {
        const nextKanban = await service.moveKanbanCard({
          kanban: workspace.kanban,
          cardId,
          direction,
          actor: "Atlas User"
        });

        setWorkspace((previous) =>
          previous
            ? {
                ...previous,
                kanban: nextKanban
              }
            : previous
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to move kanban card.");
      }
    },
    [workspace, allowPersistence]
  );

  const metrics = useMemo(() => {
    if (!workspace) return null;

    const opportunities = workspace.opportunities;
    const avgScore = opportunities.length
      ? Math.round(opportunities.reduce((sum, opp) => sum + opp.score, 0) / opportunities.length)
      : 0;

    const tierOne = opportunities.filter((opp) => opp.band === "Tier 1").length;
    const totalPotential = opportunities.reduce((sum, opp) => sum + opp.account.arrPotential, 0);

    const connectorWarnings = workspace.connectorHealth.filter((connector) => connector.health === "warning").length;

    return {
      avgScore,
      tierOne,
      totalPotential,
      accounts: workspace.accounts.length,
      signalCount: Object.values(workspace.signalProfilesByAccount).reduce(
        (sum, profile) => sum + profile.signals.length,
        0
      ),
      connectorWarnings
    };
  }, [workspace]);

  return {
    workspace,
    metrics,
    loading,
    refreshing,
    error,
    allowPersistence,
    refresh: () => load({ refresh: true }),
    moveKanbanCard
  };
}
