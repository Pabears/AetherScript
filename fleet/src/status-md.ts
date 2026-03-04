// ============================================================
// Fleet Commander — Markdown Status Writer
// Writes /workspace/aesc-fleet-status.md for easy monitoring
// ============================================================

import { writeFileSync } from 'fs'
import { join } from 'path'
import type { FleetTask, PhaseResult, StepLog } from './types.ts'
import { listTasks } from './state.ts'

const STATUS_FILE = '/workspace/aesc-fleet-status.md'

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    'aesc-pre':  '📐 aesc-pre  需求 & 架构',
    'aesc-gen':  '⚙️  aesc-gen  并行实现',
    'aesc-test': '🧪 aesc-test 测试 & 放行',
    'done':      '✅ 全部完成',
    'failed':    '❌ 失败',
  }
  return map[phase] ?? phase
}

function statusIcon(status: string): string {
  return { pending: '⏳', running: '🔄', done: '✅', failed: '❌' }[status] ?? '❓'
}

function renderStep(step: StepLog): string {
  const icon = statusIcon(step.status)
  const dur = step.completedAt && step.startedAt
    ? `${Math.round((new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000)}s`
    : step.status === 'running' ? '运行中…' : ''
  const durStr = dur ? ` _(${dur})_` : ''
  return [
    `  - ${icon} **${step.emoji} ${step.role}**${durStr}`,
    step.summary ? `    > ${step.summary.replace(/\n/g, ' ').slice(0, 200)}` : '',
  ].filter(Boolean).join('\n')
}

function renderPhase(label: string, result: PhaseResult | null, isCurrent: boolean): string {
  if (!result) {
    return `### ${label}\n_尚未开始_\n`
  }

  const icon = statusIcon(result.status)
  const verdict = result.verdict
    ? `\n**裁决：** ${result.verdict.action === 'approve' ? '✅ 通过' : '❌ 驳回'}${result.verdict.note ? ` — ${result.verdict.note}` : ''}`
    : ''

  const steps = result.steps.map(renderStep).join('\n')

  return [
    `### ${icon} ${label}${isCurrent ? ' ← _当前_' : ''}`,
    steps || '_无步骤记录_',
    verdict,
    '',
  ].join('\n')
}

function renderTask(task: FleetTask): string {
  const currentIcon = statusIcon(
    task.currentPhase === 'done' ? 'done' : 'running'
  )

  const lines: string[] = [
    `## ${currentIcon} ${task.name}`,
    `- **需求：** ${task.requirement}`,
    `- **当前阶段：** ${phaseLabel(task.currentPhase)}`,
    `- **创建时间：** ${new Date(task.createdAt).toLocaleString('zh-CN')}`,
    '',
    renderPhase('aesc-pre  需求 & 架构', task.phases.pre,  task.currentPhase === 'aesc-pre'),
    renderPhase('aesc-gen  并行实现',    task.phases.gen,  task.currentPhase === 'aesc-gen'),
    renderPhase('aesc-test 测试 & 放行', task.phases.test, task.currentPhase === 'aesc-test'),
    '---',
  ]
  return lines.join('\n')
}

/**
 * Re-read all tasks from disk and overwrite the status file.
 * Call this after every state mutation.
 */
export function writeStatusMd(tasks?: FleetTask[]): void {
  const all = tasks ?? listTasks()
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })

  const body = all.length === 0
    ? '_暂无任务_\n'
    : all.map(renderTask).join('\n')

  const content = [
    '# 🚀 AetherScript Fleet 状态看板',
    '',
    `> 最后更新：${now}`,
    '',
    body,
  ].join('\n')

  writeFileSync(STATUS_FILE, content, 'utf-8')
}
