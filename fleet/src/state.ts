// ============================================================
// Fleet Commander — State Machine
// Manages task lifecycle with JSON file persistence
// ============================================================

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type {
  FleetTask,
  FleetPhase,
  StepLog,
  PhaseOutput,
  VerdictAction,
  PhaseResult,
} from './types.ts'

// Data directory: fleet/.data/tasks/
const DATA_DIR = join(import.meta.dir, '..', '.data', 'tasks')

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function taskPath(id: string) {
  return join(DATA_DIR, `${id}.json`)
}

function readTask(id: string): FleetTask | null {
  const path = taskPath(id)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as FleetTask
  } catch {
    return null
  }
}

function writeTask(task: FleetTask) {
  ensureDataDir()
  writeFileSync(taskPath(task.id), JSON.stringify(task, null, 2), 'utf-8')
}

function generateId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Public API ────────────────────────────────────────────────

/**
 * Create a new FleetTask and persist it.
 */
export function createTask(name: string, requirement: string): FleetTask {
  ensureDataDir()
  const task: FleetTask = {
    id: generateId(),
    name,
    requirement,
    createdAt: new Date().toISOString(),
    currentPhase: 'aesc-pre',
    phases: {
      pre: null,
      gen: null,
      test: null,
    },
  }
  writeTask(task)
  return task
}

/**
 * Read a single task by ID.
 */
export function getTask(id: string): FleetTask | null {
  return readTask(id)
}

/**
 * List all tasks, sorted by createdAt descending.
 */
export function listTasks(): FleetTask[] {
  ensureDataDir()
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  const tasks: FleetTask[] = []
  for (const file of files) {
    try {
      const raw = readFileSync(join(DATA_DIR, file), 'utf-8')
      tasks.push(JSON.parse(raw) as FleetTask)
    } catch {
      // skip corrupted files
    }
  }
  return tasks.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

/**
 * Ensure a phase result exists (in 'running' status), then push/update a step log.
 * If the step with the same role already exists, it is replaced.
 */
export function updatePhaseStep(
  taskId: string,
  phase: 'pre' | 'gen' | 'test',
  stepLog: StepLog
): FleetTask | null {
  const task = readTask(taskId)
  if (!task) return null

  const phaseKey = phase
  if (!task.phases[phaseKey]) {
    const fleetPhase: FleetPhase = `aesc-${phase}` as FleetPhase
    task.phases[phaseKey] = {
      phase: fleetPhase,
      status: 'running',
      startedAt: new Date().toISOString(),
      steps: [],
      output: {},
    }
    task.currentPhase = fleetPhase
  }

  const phaseResult = task.phases[phaseKey]!
  const existingIdx = phaseResult.steps.findIndex(s => s.role === stepLog.role)
  if (existingIdx >= 0) {
    phaseResult.steps[existingIdx] = stepLog
  } else {
    phaseResult.steps.push(stepLog)
  }

  writeTask(task)
  return task
}

/**
 * Mark a phase as completed with its output.
 */
export function completePhase(
  taskId: string,
  phase: 'pre' | 'gen' | 'test',
  output: PhaseOutput
): FleetTask | null {
  const task = readTask(taskId)
  if (!task) return null

  const phaseKey = phase
  if (!task.phases[phaseKey]) {
    const fleetPhase: FleetPhase = `aesc-${phase}` as FleetPhase
    task.phases[phaseKey] = {
      phase: fleetPhase,
      status: 'done',
      startedAt: new Date().toISOString(),
      steps: [],
      output,
    }
  } else {
    const phaseResult = task.phases[phaseKey]!
    phaseResult.status = 'done'
    phaseResult.completedAt = new Date().toISOString()
    phaseResult.output = { ...phaseResult.output, ...output }
  }

  writeTask(task)
  return task
}

/**
 * Record a human verdict (approve / reject) on a completed phase.
 */
export function recordVerdict(
  taskId: string,
  phase: 'pre' | 'gen' | 'test',
  action: VerdictAction,
  note?: string
): FleetTask | null {
  const task = readTask(taskId)
  if (!task) return null

  const phaseResult = task.phases[phase]
  if (!phaseResult) return null

  phaseResult.verdict = {
    action,
    note,
    decidedAt: new Date().toISOString(),
  }

  if (action === 'reject') {
    // Reset phase so it can be re-run
    phaseResult.status = 'failed'
  }

  writeTask(task)
  return task
}

/**
 * After an approved verdict, advance the task to the next phase.
 * pre → gen → test → done
 */
export function advanceToNextPhase(taskId: string): FleetTask | null {
  const task = readTask(taskId)
  if (!task) return null

  const progression: Record<string, FleetPhase> = {
    'aesc-pre': 'aesc-gen',
    'aesc-gen': 'aesc-test',
    'aesc-test': 'done',
  }

  const next = progression[task.currentPhase]
  if (next) {
    task.currentPhase = next
  }

  writeTask(task)
  return task
}

/**
 * Utility: initialize a phase as 'running' if not already started.
 */
export function startPhase(
  taskId: string,
  phase: 'pre' | 'gen' | 'test'
): FleetTask | null {
  const task = readTask(taskId)
  if (!task) return null

  if (!task.phases[phase]) {
    const fleetPhase: FleetPhase = `aesc-${phase}` as FleetPhase
    const newPhase: PhaseResult = {
      phase: fleetPhase,
      status: 'running',
      startedAt: new Date().toISOString(),
      steps: [],
      output: {},
    }
    task.phases[phase] = newPhase
    task.currentPhase = fleetPhase
    writeTask(task)
  }

  return task
}
