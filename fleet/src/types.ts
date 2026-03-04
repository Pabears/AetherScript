// ============================================================
// Fleet Commander — Core Type Definitions
// ============================================================

export type FleetPhase = 'aesc-pre' | 'aesc-gen' | 'aesc-test' | 'done' | 'failed'
export type StepStatus = 'pending' | 'running' | 'done' | 'failed'
export type VerdictAction = 'approve' | 'reject'

export interface FleetTask {
  id: string
  name: string           // 项目名称
  requirement: string    // 用户原始需求
  createdAt: string
  currentPhase: FleetPhase
  phases: {
    pre: PhaseResult | null
    gen: PhaseResult | null
    test: PhaseResult | null
  }
}

export interface PhaseResult {
  phase: FleetPhase
  status: StepStatus
  startedAt: string
  completedAt?: string
  steps: StepLog[]
  output: PhaseOutput
  verdict?: {
    action: VerdictAction
    note?: string
    decidedAt: string
  }
}

export interface PhaseOutput {
  // aesc-pre 产出
  prd?: string
  abstractClasses?: string[]
  // aesc-gen 产出
  implementations?: RoleImpl[]
  winner?: string
  // aesc-test 产出
  tests?: RoleTest[]
  lgtm?: boolean
}

export interface StepLog {
  role: string        // 角色名（如"架构暴君"）
  emoji: string
  status: StepStatus
  startedAt: string
  completedAt?: string
  summary: string     // 输出摘要（前200字）
  fullOutput?: string
}

export interface RoleImpl {
  team: '稳健派' | '性能派' | '优雅派'
  content: string
  score?: number
}

export interface RoleTest {
  dimension: '质量' | '安全' | '性能'
  content: string
  passed?: boolean
}

// API request/response helpers
export interface CreateTaskRequest {
  name: string
  requirement: string
}

export interface VerdictRequest {
  phase: 'pre' | 'gen' | 'test'
  action: VerdictAction
  note?: string
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
