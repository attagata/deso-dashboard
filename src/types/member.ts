export type Rank = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
export type Activity = 'Online' | 'Recently Active' | 'Away' | 'Review Required' | 'Unknown';
export type Status = 'active' | 'departed' | 'unobserved';

// Daily schema v2 retains the source's million-power precision and activity text.
export interface RawObservation {
  player_id: string;
  name: string;
  rank: Rank | null;
  base_level: number | null;
  power_m: number | null;
  visible: boolean;
  last_seen: string | null;
  last_seen_minutes: number | null;
  online_at_capture: boolean | null;
  source: string;
  identity_uncertain?: boolean;
  membership_status?: string;
  profile?: Record<string, unknown>;
}
export interface MembershipEvent {
  event_type: 'departure' | 'rejoin';
  player_id: string;
  name: string;
  recorded_on: string;
  effective_date: string | null;
  previous_rank?: Rank | null;
  source: string;
}
export interface DailySnapshot {
  schema_version: 2;
  date: string;
  alliance: { tag: string; name: string; server: string; [key: string]: unknown };
  summary: {
    reported_members?: number | null;
    reported_ranks?: Partial<Record<Rank, number>>;
    alliance_power?: number | null;
    [key: string]: unknown;
  };
  observations: RawObservation[];
  membership_events: MembershipEvent[];
  data_policy?: Record<string, string>;
}
export interface Observation {
  date: string;
  name: string;
  rank: Rank | null;
  level: number | null;
  power: number | null;
  visible: boolean;
  activityText: string | null;
  inactivityMinutes: number | null;
  online: boolean | null;
  identityUncertain: boolean;
}
export interface Member { id: string; history: Observation[]; events: MembershipEvent[] }
export interface Dataset { dates: string[]; snapshots: DailySnapshot[]; members: Member[] }
export interface MemberRow {
  member: Member;
  name: string;
  observation: Observation | null;
  lastKnown: Observation | null;
  status: Status;
  position: number | null;
  change: { absolute: number; percent: number | null } | null;
  activity: Activity;
}
