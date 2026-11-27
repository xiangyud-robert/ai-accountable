// The API's JSON. Dates are YYYY-MM-DD, and times are ISO 8601 with no zone, on the team's clock
// (concern 16). The browser reads and shows them as they are (see teamTime.ts).

export type StageKey = 'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type Status = 'lead' | 'qualified' | 'customer'
export type ActivityType = 'note' | 'call' | 'email'

export type Stage = {
  key: StageKey
  name: string
  order: number
  probability: number
  open: boolean
}

export type Ref = { id: number; name: string }

/** Someone on the team, by their name and initials (R16). */
export type Person = { id: string; name: string; initials: string }

export type OrganizationRow = {
  id: number
  name: string
  website: string | null
  industry: string | null
  notes: string | null
  contact_count: number
  deal_count: number
  open_deal_count: number
  open_value: number
  created_at: string
  updated_at: string
  /** Who added it and who last changed it (R17), or null for a record from before sign-in. */
  created_by: Person | null
  updated_by: Person | null
}

export type ContactRow = {
  id: number
  name: string
  email: string | null
  phone: string | null
  job_title: string | null
  organization_id: number | null
  organization_name: string | null
  status: Status
  deal_count: number
  activity_count: number
  created_at: string
  updated_at: string
  /** Who added it and who last changed it (R17), or null for a record from before sign-in. */
  created_by: Person | null
  updated_by: Person | null
}

export type DealRow = {
  id: number
  name: string
  organization_id: number | null
  organization_name: string | null
  contact_id: number | null
  contact_name: string | null
  stage: StageKey
  value: number
  probability: number
  expected: number
  close_date: string
  position: number
  late: boolean
  activity_count: number
  created_at: string
  updated_at: string
  /** Who added it and who last changed it (R17), or null for a record from before sign-in. */
  created_by: Person | null
  updated_by: Person | null
}

export type TimelineEntry = {
  key: string
  kind: 'activity' | 'stage_change' | 'status_change'
  id: number
  at: string
  text: string
  record: 'contact' | 'deal'
  type: ActivityType | null
  follow_up_date: string | null
  follow_up_done: boolean | null
  /** Whether the follow-up is overdue, which the backend decides (R9). */
  follow_up_overdue: boolean | null
  from_value: string | null
  to_value: string | null
  contact_id: number | null
  contact_name: string | null
  deal_id: number | null
  deal_name: string | null
  /** Who logged an activity, or null for stage and status changes and from before sign-in. */
  created_by: Person | null
}

export type OrganizationDetail = OrganizationRow & {
  contacts: ContactRow[]
  deals: DealRow[]
  won_value: number
}

export type ContactDetail = ContactRow & {
  organization: Ref | null
  deals: DealRow[]
  timeline: TimelineEntry[]
}

export type DealDetail = DealRow & { timeline: TimelineEntry[] }

export type Activity = {
  id: number
  type: ActivityType
  contact_id: number | null
  deal_id: number | null
  description: string
  occurred_at: string
  follow_up_date: string | null
  follow_up_done: boolean
  created_at: string
  updated_at: string
  created_by: Person | null
  updated_by: Person | null
}

export type MonthFigures = { month: string; revenue: number; count: number }
export type StageFigures = { stage: StageKey; count: number; value: number; expected: number }
export type FunnelStage = { stage: StageKey; count: number; value: number }

export type FollowUp = {
  id: number
  type: ActivityType
  description: string
  follow_up_date: string
  days: number
  overdue: boolean
  contact_id: number | null
  contact_name: string | null
  deal_id: number | null
  deal_name: string | null
  /** Who logged it, or null from before sign-in. */
  created_by: Person | null
}

export type Dashboard = {
  today: string
  this_month: MonthFigures
  last_month: MonthFigures
  months: MonthFigures[]
  last_12_months: { count: number; value: number }
  open: { count: number; value: number; expected: number }
  by_stage: StageFigures[]
  funnel: FunnelStage[]
  lost: { count: number; value: number }
  follow_ups: FollowUp[]
  recent: TimelineEntry[]
}
