// ============================================================
// Fleet Commander — REST API Router
// ============================================================

import {
  createTask,
  getTask,
  listTasks,
  recordVerdict,
  advanceToNextPhase,
} from './state.ts'
import type { CreateTaskRequest, VerdictRequest, ApiResponse } from './types.ts'

function json<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function notFound(msg = 'Not found') {
  return json({ ok: false, error: msg }, 404)
}

function badRequest(msg: string) {
  return json({ ok: false, error: msg }, 400)
}

async function parseBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

export async function handleApi(req: Request, url: URL): Promise<Response> {
  const method = req.method.toUpperCase()
  const pathname = url.pathname

  // ── GET /api/tasks ───────────────────────────────────────
  if (method === 'GET' && pathname === '/api/tasks') {
    const tasks = listTasks()
    return json({ ok: true, data: tasks })
  }

  // ── POST /api/tasks ──────────────────────────────────────
  if (method === 'POST' && pathname === '/api/tasks') {
    const body = await parseBody<CreateTaskRequest>(req)
    if (!body?.name || !body?.requirement) {
      return badRequest('name and requirement are required')
    }
    const task = createTask(body.name, body.requirement)
    return json({ ok: true, data: task }, 201)
  }

  // ── Match /api/tasks/:id[/...] ───────────────────────────
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)(\/.*)?$/)
  if (!taskMatch) {
    return notFound('Unknown API route')
  }

  const taskId = taskMatch[1]!
  const subPath = taskMatch[2] ?? ''

  // ── GET /api/tasks/:id ───────────────────────────────────
  if (method === 'GET' && subPath === '') {
    const task = getTask(taskId)
    if (!task) return notFound('Task not found')
    return json({ ok: true, data: task })
  }

  // ── POST /api/tasks/:id/verdict ──────────────────────────
  if (method === 'POST' && subPath === '/verdict') {
    const task = getTask(taskId)
    if (!task) return notFound('Task not found')

    const body = await parseBody<VerdictRequest>(req)
    if (!body?.phase || !body?.action) {
      return badRequest('phase and action are required')
    }
    if (!['pre', 'gen', 'test'].includes(body.phase)) {
      return badRequest('phase must be pre, gen, or test')
    }
    if (!['approve', 'reject'].includes(body.action)) {
      return badRequest('action must be approve or reject')
    }

    const phaseResult = task.phases[body.phase]
    if (!phaseResult) {
      return badRequest(`Phase ${body.phase} has not started yet`)
    }
    if (phaseResult.status !== 'done') {
      return badRequest(`Phase ${body.phase} is not completed yet`)
    }
    if (phaseResult.verdict) {
      return badRequest(`Phase ${body.phase} already has a verdict`)
    }

    const updated = recordVerdict(taskId, body.phase, body.action, body.note)
    if (!updated) return notFound('Task not found')

    // Auto-advance on approve
    if (body.action === 'approve') {
      const advanced = advanceToNextPhase(taskId)
      return json({ ok: true, data: advanced })
    }

    return json({ ok: true, data: updated })
  }

  // ── POST /api/tasks/:id/start ────────────────────────────
  if (method === 'POST' && subPath === '/start') {
    return new Response(
      JSON.stringify({ ok: false, error: 'Phase execution not yet implemented' }),
      {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  return notFound('Unknown API route')
}
