/** Shapes returned by the BlindNav v2 API (backend/api/*). */

export type ProfileId = 'accessible' | 'fast' | 'lit' | 'wheelchair'

export type Severity = 'none' | 'low' | 'medium' | 'high'

export interface LatLon {
  lat: number
  lon: number
}

/** A coordinate pair as the API returns it: [lat, lon]. */
export type Coord = [number, number]

export interface AreaMeta {
  id: string
  name: string
  lat: number
  lon: number
  span_m: number
  zoom: number
}

export interface ProfileMeta {
  id: ProfileId
  label: string
  short: string
  description: string
  color: string
  accent: string
  icon: string
  mode: string
}

export interface TimeSlotMeta {
  name: string
  label: string
  icon: string
  start_hour: number
  end_hour: number
  lighting_multiplier: number
  crowd_multiplier: number
}

export interface ScaleStop {
  value: string
  color: string
  label: string
}

export interface SegmentFactor {
  id: string
  label: string
  description: string
  icon: string
  default: boolean
  scale: ScaleStop[]
}

export interface RiskTypeMeta {
  type: string
  label: string
  icon: string
  severity: Severity
}

export interface SeverityMeta {
  id: Severity
  label: string
  color: string
}

export interface Meta {
  api_version: string
  ui: string
  areas: AreaMeta[]
  default_area: string
  profiles: ProfileMeta[]
  default_profiles: ProfileId[]
  max_profiles: number
  modes: { id: string; name: string; description: string; weights: Record<string, number> }[]
  time_slots: TimeSlotMeta[]
  segment_factors: SegmentFactor[]
  risk_catalog: RiskTypeMeta[]
  severities: SeverityMeta[]
  graph: { nodes: number; edges: number; avg_degree: number; area: string | null }
}

export interface RiskReason {
  code: string
  label: string
  severity: Severity
}

export interface Segment {
  index: number
  from: Coord
  to: Coord
  coordinates: Coord[]
  length_m: number
  duration_s: number
  highway: string
  name: string | null
  tactile_paving: string
  lit: string
  sidewalk: string
  surface: string
  incline_pct: number
  width_m: number | null
  steps: boolean
  risk: Severity
  risk_reasons: RiskReason[]
}

export interface RiskEvent {
  id: string
  type: string
  severity: Severity
  label: string
  detail: string
  from: Coord
  to: Coord
  at: Coord
  offset_m: number
  length_m: number
  segment_indexes: number[]
}

export interface Direction {
  type: string
  icon: string
  instruction: string
  street: string | null
  distance_m: number
  position: Coord
  angle: number | null
}

export interface RouteMetrics {
  total_edges: number
  tactile_pct: number
  lit_pct: number
  sidewalk_pct: number
  steps_count: number
  steps_length_m: number
  max_incline_pct: number
  mean_incline_pct: number
  min_width_m: number | null
  rough_length_m: number
  top_highways: { name: string; pct: number }[]
}

export interface RouteFactors {
  tactile: number
  lighting: number
  sidewalk: number
  surface: number
  incline: number
  width: number
}

export interface RoutePlan {
  id: ProfileId
  label: string
  short: string
  description: string
  color: string
  accent: string
  icon: string
  mode: string
  score: number
  grade: string
  factors: RouteFactors
  score_penalty: number
  summary: string
  total_distance_m: number
  duration_s: number
  duration_min: number
  total_cost: number
  static_cost: number
  dynamic_adjustment: number | null
  algorithm: string
  explored_count: number
  num_nodes: number
  meet_node?: number
  path: Coord[]
  path_node_ids: number[]
  segments: Segment[]
  risks: RiskEvent[]
  directions: Direction[]
  metrics: RouteMetrics
  bounds: { south: number; north: number; west: number; east: number }
  also_matches: string[]
}

export interface SnapInfo {
  node_id: number
  lat: number
  lon: number
  distance_m: number
}

export interface RoutesResponse {
  status: 'success'
  request: {
    hour: number
    area: string
    profiles: ProfileId[]
    use_dynamic_cost: boolean
    time_slot: {
      name: string
      start_hour: number
      end_hour: number
      lighting_multiplier: number
      crowd_multiplier: number
    }
  }
  snapped: { start: SnapInfo; end: SnapInfo }
  graph: { nodes: number; edges: number; avg_degree: number; area: string | null }
  routes: RoutePlan[]
  highlights: {
    best_score: ProfileId
    fastest: ProfileId
    shortest: ProfileId
    aliases: Record<string, string[]>
  }
}

export interface Place {
  id: string
  name: string
  label: string
  category: string | null
  type: string | null
  lat: number
  lon: number
  bbox: { south: number; north: number; west: number; east: number } | null
}

export interface ApiError {
  status: 'error'
  code: string
  message: string
}

export class BlindNavError extends Error {
  code: string
  constructor(message: string, code = 'unknown') {
    super(message)
    this.name = 'BlindNavError'
    this.code = code
  }
}
