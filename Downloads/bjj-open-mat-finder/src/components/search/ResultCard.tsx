import Link from 'next/link';
import { MapPin, Clock, Users, Phone, Star, Globe, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import {
  type Gym,
  type OpenMat,
  type VisitorAccess,
  type ConfidenceLevel,
  type WomenPresence,
  type IntensityLevel,
  DAY_NAMES_SHORT,
  formatTime,
  formatPrice,
  VISITOR_ACCESS_LABELS,
  CONFIDENCE_LABELS,
  WOMEN_PRESENCE_LABELS,
  INTENSITY_LABELS,
} from '@/lib/types';
import { getNextOccurrence } from '@/lib/utils';

interface ResultCardProps {
  gym: Gym;
  distance?: number;
}

function getNextOpenMat(openMats: OpenMat[]): OpenMat | null {
  if (!openMats || openMats.length === 0) return null;

  let nearest: OpenMat | null = null;
  let nearestDate: Date | null = null;

  for (const om of openMats) {
    const next = getNextOccurrence(om.day_of_week, om.start_time);
    if (!nearestDate || next < nearestDate) {
      nearestDate = next;
      nearest = om;
    }
  }

  return nearest;
}

/** Pick the most relevant visitor access across all open mats (best = open_to_all) */
function getBestVisitorAccess(openMats: OpenMat[]): VisitorAccess {
  const priority: VisitorAccess[] = ['open_to_all', 'contact_first', 'members_only', 'unknown'];
  for (const level of priority) {
    if (openMats.some((om) => om.visitor_access === level)) return level;
  }
  return 'unknown';
}

/** Pick highest confidence across all open mats */
function getBestConfidence(openMats: OpenMat[]): ConfidenceLevel {
  const priority: ConfidenceLevel[] = ['high', 'medium', 'low', 'unverified'];
  for (const level of priority) {
    if (openMats.some((om) => om.confidence_score === level)) return level;
  }
  return 'unverified';
}

/** Pick the most prominent women's presence */
function getBestWomenPresence(openMats: OpenMat[]): WomenPresence {
  const priority: WomenPresence[] = ['women_specific', 'regularly_attend', 'sometimes', 'rarely', 'unknown'];
  for (const level of priority) {
    if (openMats.some((om) => om.women_presence === level)) return level;
  }
  return 'unknown';
}

/** Pick the most notable intensity */
function getPrimaryIntensity(openMats: OpenMat[]): IntensityLevel {
  const priority: IntensityLevel[] = ['competition', 'moderate', 'casual', 'varies', 'unknown'];
  for (const level of priority) {
    if (openMats.some((om) => om.intensity === level)) return level;
  }
  return 'unknown';
}

// --- Visitor access badge styles ---
const visitorAccessStyles: Record<VisitorAccess, string> = {
  open_to_all: 'bg-green-100 text-green-800 ring-1 ring-green-300',
  contact_first: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  members_only: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  unknown: 'bg-gray-100 text-gray-600 ring-1 ring-gray-300',
};

// --- Confidence dot colors ---
const confidenceDotStyles: Record<ConfidenceLevel, string> = {
  high: 'bg-green-500',
  medium: 'bg-yellow-500',
  low: 'bg-orange-500',
  unverified: 'bg-gray-400',
};

// --- Intensity tag styles ---
const intensityStyles: Record<IntensityLevel, string> = {
  casual: 'bg-blue-100 text-blue-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  competition: 'bg-red-100 text-red-700',
  varies: 'bg-gray-100 text-gray-600',
  unknown: '',
};

// --- Women's presence styles ---
const womenPresenceStyles: Record<WomenPresence, string> = {
  regularly_attend: 'bg-purple-100 text-purple-800',
  women_specific: 'bg-purple-100 text-purple-800',
  sometimes: 'bg-purple-50 text-purple-600',
  rarely: '',
  unknown: '',
};

export default function ResultCard({ gym, distance }: ResultCardProps) {
  const openMats = gym.open_mats || [];
  const nextMat = getNextOpenMat(openMats);
  const totalRsvps = openMats.reduce((sum, om) => sum + (om.rsvp_count || 0), 0);

  // Derived taxonomy signals
  const visitorAccess = getBestVisitorAccess(openMats);
  const confidence = getBestConfidence(openMats);
  const womenPresence = getBestWomenPresence(openMats);
  const intensity = getPrimaryIntensity(openMats);

  // Contact instructions from the first open mat that requires advance contact
  const contactMat = openMats.find((om) => om.advance_contact_required && om.contact_instructions);

  // Gyms without open mats get a simplified card layout
  if (openMats.length === 0) {
    return (
      <Card hover className="relative">
        <Link href={`/gym/${gym.id}`} className="absolute inset-0 z-10" aria-label={`View ${gym.name}`} />

        <div className="flex flex-col gap-3">
          {/* Header row: name only (no visitor access badge without open mat data) */}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#1e3a5f] truncate">
              {gym.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                {gym.address}, {gym.city}, {gym.state}
              </span>
            </div>
          </div>

          {/* Distance */}
          {distance !== undefined && !isNaN(distance) && (
            <p className="text-sm text-gray-500">
              {distance < 1 ? '< 1' : distance.toFixed(1)} mi away
            </p>
          )}

          {/* Google rating — prominent for discovered gyms without open mat data */}
          {gym.google_rating && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              <span>
                {gym.google_rating.toFixed(1)} on Google
                {gym.google_user_ratings_total
                  ? ` (${gym.google_user_ratings_total.toLocaleString()} reviews)`
                  : ''}
              </span>
            </div>
          )}

          {/* No open mat schedule CTA */}
          <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-md px-3 py-2">
            <p className="font-medium text-gray-500">No open mat schedule yet</p>
            <p className="mt-0.5">
              Know their schedule?{' '}
              <Link href="/submit" className="relative z-20 text-[#f97316] hover:underline font-medium">
                Help the community — submit it!
              </Link>
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card hover className="relative">
      <Link href={`/gym/${gym.id}`} className="absolute inset-0 z-10" aria-label={`View ${gym.name}`} />

      <div className="flex flex-col gap-3">
        {/* Header row: name + visitor access badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#1e3a5f] truncate">
              {gym.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">
                {gym.address}, {gym.city}, {gym.state}
              </span>
            </div>
          </div>

          {/* Visitor Access Badge — most prominent new signal */}
          <span
            className={cn(
              'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold flex-shrink-0',
              visitorAccessStyles[visitorAccess]
            )}
          >
            {VISITOR_ACCESS_LABELS[visitorAccess]}
          </span>
        </div>

        {/* Confidence indicator */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', confidenceDotStyles[confidence])} />
          <span>{CONFIDENCE_LABELS[confidence]}</span>
        </div>

        {/* Distance */}
        {distance !== undefined && !isNaN(distance) && (
          <p className="text-sm text-gray-500">
            {distance < 1 ? '< 1' : distance.toFixed(1)} mi away
          </p>
        )}

        {/* Open mat schedule */}
        {openMats.length > 0 && (
          <div className="space-y-1">
            {openMats
              .slice()
              .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
              .map((om) => (
                <div key={om.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <span className="font-medium w-10">{DAY_NAMES_SHORT[om.day_of_week]}</span>
                  <span>
                    {formatTime(om.start_time)} &ndash; {formatTime(om.end_time)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {om.type === 'gi' ? 'Gi' : om.type === 'nogi' ? 'No-Gi' : 'Gi & No-Gi'}
                  </span>
                  {om.source_type === 'google_search' && (
                    <span className="text-xs text-gray-400 italic">via search</span>
                  )}
                  {(om.confidence_score === 'low' || om.confidence_score === 'unverified') && (
                    <a
                      href={`/submit?gym_id=${gym.id}&gym_name=${encodeURIComponent(gym.name)}`}
                      className="text-xs text-blue-500 hover:text-blue-700 underline ml-auto relative z-20"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Help verify
                    </a>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Badges row: gi/nogi, price, women's presence, intensity */}
        <div className="flex flex-wrap items-center gap-2">
          {openMats.map((om) => (
            <Badge
              key={om.id}
              variant={om.type === 'gi' ? 'gi' : om.type === 'nogi' ? 'nogi' : 'default'}
            >
              {om.type === 'gi' ? 'Gi' : om.type === 'nogi' ? 'No-Gi' : 'Gi & No-Gi'}
            </Badge>
          ))}
          {openMats.some((om) => om.price === 0) && (
            <Badge variant="free">Free</Badge>
          )}
          {openMats.some((om) => om.price > 0) && (
            <Badge variant="price">
              {formatPrice(Math.min(...openMats.filter((om) => om.price > 0).map((om) => om.price)))}
            </Badge>
          )}

          {/* Women's Presence — only shown when not unknown */}
          {womenPresence !== 'unknown' && womenPresence !== 'rarely' && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                womenPresenceStyles[womenPresence]
              )}
            >
              {WOMEN_PRESENCE_LABELS[womenPresence]}
            </span>
          )}

          {/* Intensity — only shown when not unknown */}
          {intensity !== 'unknown' && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                intensityStyles[intensity]
              )}
            >
              {INTENSITY_LABELS[intensity]}
            </span>
          )}
        </div>

        {/* Contact instructions — shown when advance contact required */}
        {contactMat && (
          <div className="flex items-start gap-1.5 text-xs text-gray-600 bg-amber-50 rounded-md px-2.5 py-1.5">
            <Phone className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
            <span>{contactMat.contact_instructions}</span>
          </div>
        )}

        {/* RSVP count */}
        {totalRsvps > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            <span>{totalRsvps} {totalRsvps === 1 ? 'person' : 'people'} going this week</span>
          </div>
        )}

        {/* Google rating — shown for discovered gyms */}
        {gym.google_rating && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span>
              {gym.google_rating.toFixed(1)} on Google
              {gym.google_user_ratings_total
                ? ` (${gym.google_user_ratings_total.toLocaleString()} reviews)`
                : ''}
            </span>
          </div>
        )}

        {/* Open mat session count */}
        <p className="text-xs text-gray-400">
          {openMats.length} open mat {openMats.length === 1 ? 'session' : 'sessions'} / week
        </p>
      </div>
    </Card>
  );
}
