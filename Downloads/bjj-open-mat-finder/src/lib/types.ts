// ============================================================
// Enums — North Star Taxonomy (Section 5) + Data Quality (Section 10)
// ============================================================

export type MartialArtType = 'gi' | 'nogi' | 'both';
export type RsvpStatus = 'going' | 'maybe' | 'went';
export type SubmissionType = 'new_gym' | 'new_open_mat' | 'update' | 'report';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type BeltRank = 'white' | 'blue' | 'purple' | 'brown' | 'black';

// North Star Section 5, Axis 2 — Access
export type VisitorAccess = 'open_to_all' | 'contact_first' | 'members_only' | 'unknown';

// North Star Section 5, Axis 3 — Intensity
export type IntensityLevel = 'casual' | 'moderate' | 'competition' | 'varies' | 'unknown';

// North Star Section 5, Axis 1 — Structure
export type StructureLevel = 'freeform' | 'semi_structured' | 'structured' | 'unknown';

// Session format / purpose
export type SessionFormat = 'rolling' | 'drilling' | 'mixed' | 'positional' | 'unknown';

// North Star Section 4 — Women's presence
export type WomenPresence = 'regularly_attend' | 'sometimes' | 'rarely' | 'women_specific' | 'unknown';

// Participant experience
export type BeginnerFriendly = 'yes' | 'somewhat' | 'not_really' | 'unknown';
export type CoachingPresence = 'yes' | 'sometimes' | 'no' | 'unknown';
export type AgePolicy = 'adults_only' | 'all_ages' | 'kids_separate' | 'unknown';

// Gym-level visitor policy (North Star Section 9)
export type GymVisitorPolicy = 'always_welcome' | 'usually_welcome' | 'contact_first' | 'members_only' | 'unknown';

// Data quality (North Star Section 10)
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unverified';
export type FreshnessStatus = 'confirmed_current' | 'likely_current' | 'possibly_stale' | 'unverified';
export type ConfirmationMethod = 'gym_confirmed' | 'community_report' | 'social_media' | 'website_scrape' | 'directory_listing';

// Moderation
export type ReportReason = 'inaccurate' | 'closed' | 'spam' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved';


// ============================================================
// Structured objects
// ============================================================

/** North Star Section 14 — Drop-in fee structure */
export interface DropInFee {
  free?: boolean;
  amount?: number;
  currency?: string;
  first_visit_free?: boolean;
  unknown?: boolean;
}

/** North Star Section 10 — Evidence source for data quality */
export interface EvidenceSource {
  type: string;
  url?: string;
  date?: string;
  note?: string;
}

/** Social media links */
export interface SocialMedia {
  instagram?: string;
  facebook?: string;
  youtube?: string;
}


// ============================================================
// Core Interfaces
// ============================================================

export interface Gym {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  description: string | null;
  photo_url: string | null;
  claimed: boolean;
  owner_id: string | null;
  created_at: string;
  updated_at: string;

  // North Star Section 9 — Gym culture and policy
  affiliation: string | null;
  social_media: SocialMedia;
  contact_method: string | null;
  general_visitor_policy: GymVisitorPolicy;
  women_regularly_train: WomenPresence;
  overall_vibe: string[];

  // Discovery layer — Google Places data
  google_place_id: string | null;
  google_rating: number | null;
  google_user_ratings_total: number | null;
  google_maps_url: string | null;
  discovery_source: 'manual' | 'google_places' | 'user_submission' | 'web_scrape' | null;

  // Extraction pipeline metadata
  platform_type?: string | null;
  schedule_page_url?: string | null;
  schedule_format?: string | null;
  last_scraped_at?: string | null;
  scrape_status?: string | null;
  scrape_error?: string | null;

  // Relations
  open_mats?: OpenMat[];
}

export interface OpenMat {
  id: string;
  gym_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string; // HH:MM:SS
  end_time: string;
  type: MartialArtType;
  price: number; // 0 = free (legacy — use drop_in_fee for structured data)
  price_note: string | null;
  notes: string | null;
  recurring: boolean;
  specific_date: string | null;
  verified_count: number;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;

  // North Star Section 5 — Four-axis taxonomy
  visitor_access: VisitorAccess;
  advance_contact_required: boolean | null;
  contact_instructions: string | null;
  intensity: IntensityLevel;
  structure_level: StructureLevel;
  primary_format: SessionFormat;
  competition_focused: boolean;

  // North Star Sections 4, 8 — Participant experience
  beginner_friendly: BeginnerFriendly;
  women_presence: WomenPresence;
  coaching_present: CoachingPresence;
  age_policy: AgePolicy;
  typical_attendance_min: number | null;
  typical_attendance_max: number | null;

  // North Star Section 14 — Structured drop-in fee
  drop_in_fee: DropInFee;

  // North Star Section 13 — Gi/uniform policy
  uniform_restrictions: string | null;

  // North Star Section 10 — Data quality
  confidence_score: ConfidenceLevel;
  freshness_status: FreshnessStatus;
  confirmation_method: ConfirmationMethod | null;
  evidence_sources: EvidenceSource[];

  // Extraction pipeline tracking
  source_type?: 'website_scrape' | 'image_ocr' | 'social_media' | 'google_search' | 'community_submission' | 'gym_owner' | null;
  source_url?: string | null;
  last_source_check?: string | null;
  needs_review?: boolean;

  // Relations
  gym?: Gym;
  rsvp_count?: number;
}

export interface CommunityConfirmation {
  id: string;
  user_id: string;
  open_mat_id: string;
  confirmed_active: boolean;
  confirmed_date: string;

  // Optional enrichment (community-sourced observations)
  observed_visitor_access: VisitorAccess | null;
  observed_intensity: IntensityLevel | null;
  observed_women_present: boolean | null;
  observed_attendance_estimate: number | null;
  observed_coaching_present: boolean | null;

  note: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  belt_rank: BeltRank | null;
  home_gym: string | null;
  contributions: number;
  created_at: string;
}

export interface Rsvp {
  id: string;
  user_id: string;
  open_mat_id: string;
  date: string;
  status: RsvpStatus;
  created_at: string;
}

export interface Submission {
  id: string;
  user_id: string | null;
  gym_id: string | null;
  type: SubmissionType;
  data: Record<string, unknown>;
  status: SubmissionStatus;
  reviewed_at: string | null;
  created_at: string;
}

export interface Verification {
  id: string;
  user_id: string;
  open_mat_id: string;
  verified: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  gym_id: string;
  open_mat_id?: string;
  reporter_email?: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  created_at: string;
}


// ============================================================
// Search
// ============================================================

export interface SearchFilters {
  query: string;
  lat?: number;
  lng?: number;
  radius?: number; // miles
  dayOfWeek?: number[];
  type?: MartialArtType;
  freeOnly?: boolean;
  timeOfDay?: 'morning' | 'afternoon' | 'evening';

  // North Star taxonomy filters
  visitorAccess?: VisitorAccess[];
  intensity?: IntensityLevel[];
  womenPresence?: WomenPresence[];
  beginnerFriendly?: BeginnerFriendly[];
  coachingPresent?: CoachingPresence[];
  confidenceMin?: ConfidenceLevel;
}


// ============================================================
// Display helpers
// ============================================================

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

export function formatPrice(price: number): string {
  if (price === 0) return 'Free';
  return `$${price.toFixed(0)}`;
}

/** Format a DropInFee object for display */
export function formatDropInFee(fee: DropInFee): string {
  if (fee.unknown) return 'Call ahead';
  if (fee.free) return fee.first_visit_free ? 'Free (first visit free)' : 'Free';
  if (fee.amount != null) {
    const base = `$${fee.amount}`;
    return fee.first_visit_free ? `${base} (first visit free)` : base;
  }
  return 'Call ahead';
}

/** Human-readable labels for visitor access */
export const VISITOR_ACCESS_LABELS: Record<VisitorAccess, string> = {
  open_to_all: 'Walk-ins Welcome',
  contact_first: 'Contact First',
  members_only: 'Members Only',
  unknown: 'Call Ahead',
};

/** Human-readable labels for intensity */
export const INTENSITY_LABELS: Record<IntensityLevel, string> = {
  casual: 'Casual',
  moderate: 'Moderate',
  competition: 'Competition',
  varies: 'Varies',
  unknown: 'Unknown',
};

/** Human-readable labels for women's presence */
export const WOMEN_PRESENCE_LABELS: Record<WomenPresence, string> = {
  regularly_attend: 'Women Regularly Train',
  sometimes: 'Women Sometimes Present',
  rarely: 'Few Women',
  women_specific: "Women's Session",
  unknown: 'Unknown',
};

/** Human-readable labels for confidence */
export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: 'Verified',
  medium: 'Likely Accurate',
  low: 'Unconfirmed',
  unverified: 'Unverified',
};

/** Human-readable labels for freshness */
export const FRESHNESS_LABELS: Record<FreshnessStatus, string> = {
  confirmed_current: 'Recently Confirmed',
  likely_current: 'Likely Current',
  possibly_stale: 'May Be Outdated',
  unverified: 'Not Yet Verified',
};

/** Human-readable labels for beginner-friendliness */
export const BEGINNER_FRIENDLY_LABELS: Record<BeginnerFriendly, string> = {
  yes: 'Beginner Friendly',
  somewhat: 'Somewhat Beginner Friendly',
  not_really: 'Not Beginner Friendly',
  unknown: 'Unknown',
};

/** Human-readable labels for coaching */
export const COACHING_LABELS: Record<CoachingPresence, string> = {
  yes: 'Coach Present',
  sometimes: 'Coach Sometimes',
  no: 'No Coach',
  unknown: 'Unknown',
};
