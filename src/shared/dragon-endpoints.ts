/**
 * Dragon HTTP endpoint path templates. The renderer and the main
 * process IPC allow-list both derive their paths from this table, so
 * adding a new endpoint is a one-file change.
 *
 * `*TEMPLATE` constants carry the `{id}` / `{turn}` placeholders
 * literally. `*PATH(...)` builders perform the URL encoding and
 * return a concrete path for runtime use.
 */

export const DRAGON_HEALTH_PATH = '/health'
export const DRAGON_HEALTH_TEMPLATE = '/health'

export const DRAGON_RUNTIME_INFO_PATH = '/v1/runtime/info'
export const DRAGON_RUNTIME_INFO_TEMPLATE = '/v1/runtime/info'

export const DRAGON_RUNTIME_TOOLS_PATH = '/v1/runtime/tools'
export const DRAGON_RUNTIME_TOOLS_TEMPLATE = '/v1/runtime/tools'

export const DRAGON_SKILLS_PATH = '/v1/skills'
export const DRAGON_SKILLS_TEMPLATE = '/v1/skills'

export const DRAGON_ATTACHMENTS_PATH = '/v1/attachments'
export const DRAGON_ATTACHMENTS_TEMPLATE = '/v1/attachments'
export const DRAGON_ATTACHMENT_DIAGNOSTICS_PATH = '/v1/attachments/diagnostics'
export const DRAGON_ATTACHMENT_DIAGNOSTICS_TEMPLATE = '/v1/attachments/diagnostics'
export const DRAGON_ATTACHMENT_TEMPLATE = '/v1/attachments/{id}'
export function dragonAttachmentPath(attachmentId: string): string {
  return `/v1/attachments/${encodeURIComponent(attachmentId)}`
}
export const DRAGON_ATTACHMENT_CONTENT_TEMPLATE = '/v1/attachments/{id}/content'
export function dragonAttachmentContentPath(attachmentId: string): string {
  return `${dragonAttachmentPath(attachmentId)}/content`
}

export const DRAGON_MEMORY_PATH = '/v1/memory'
export const DRAGON_MEMORY_TEMPLATE = '/v1/memory'
export const DRAGON_MEMORY_DIAGNOSTICS_PATH = '/v1/memory/diagnostics'
export const DRAGON_MEMORY_DIAGNOSTICS_TEMPLATE = '/v1/memory/diagnostics'
export const DRAGON_MEMORY_RECORD_TEMPLATE = '/v1/memory/{id}'
export function dragonMemoryRecordPath(memoryId: string): string {
  return `/v1/memory/${encodeURIComponent(memoryId)}`
}

export const DRAGON_THREADS_PATH = '/v1/threads'
export const DRAGON_THREADS_TEMPLATE = '/v1/threads'

export const DRAGON_THREAD_TEMPLATE = '/v1/threads/{id}'
export function dragonThreadPath(threadId: string): string {
  return `/v1/threads/${encodeURIComponent(threadId)}`
}

export const DRAGON_THREAD_FORK_TEMPLATE = '/v1/threads/{id}/fork'
export function dragonThreadForkPath(threadId: string): string {
  return `${dragonThreadPath(threadId)}/fork`
}

export const DRAGON_THREAD_GOAL_TEMPLATE = '/v1/threads/{id}/goal'
export function dragonThreadGoalPath(threadId: string): string {
  return `${dragonThreadPath(threadId)}/goal`
}

export const DRAGON_THREAD_TODOS_TEMPLATE = '/v1/threads/{id}/todos'
export function dragonThreadTodosPath(threadId: string): string {
  return `${dragonThreadPath(threadId)}/todos`
}

export const DRAGON_THREAD_COMPACT_TEMPLATE = '/v1/threads/{id}/compact'
export function dragonThreadCompactPath(threadId: string): string {
  return `${dragonThreadPath(threadId)}/compact`
}

export const DRAGON_THREAD_REVIEW_TEMPLATE = '/v1/threads/{id}/review'
export function dragonThreadReviewPath(threadId: string): string {
  return `${dragonThreadPath(threadId)}/review`
}

export const DRAGON_THREAD_TURNS_TEMPLATE = '/v1/threads/{id}/turns'
export function dragonThreadTurnsPath(threadId: string): string {
  return `${dragonThreadPath(threadId)}/turns`
}

export const DRAGON_THREAD_STEER_TEMPLATE = '/v1/threads/{id}/turns/{turn}/steer'
export function dragonThreadSteerPath(threadId: string, turnId: string): string {
  return `${dragonThreadTurnsPath(threadId)}/${encodeURIComponent(turnId)}/steer`
}

export const DRAGON_THREAD_INTERRUPT_TEMPLATE = '/v1/threads/{id}/turns/{turn}/interrupt'
export function dragonThreadInterruptPath(threadId: string, turnId: string): string {
  return `${dragonThreadTurnsPath(threadId)}/${encodeURIComponent(turnId)}/interrupt`
}

export const DRAGON_THREAD_EVENTS_TEMPLATE = '/v1/threads/{id}/events'
export function dragonThreadEventsPath(threadId: string): string {
  return `${dragonThreadPath(threadId)}/events`
}

export const DRAGON_APPROVAL_TEMPLATE = '/v1/approvals/{id}'
export function dragonApprovalPath(approvalId: string): string {
  return `/v1/approvals/${encodeURIComponent(approvalId)}`
}

export const DRAGON_USER_INPUT_TEMPLATE = '/v1/user-inputs/{id}'
export function dragonUserInputPath(inputId: string): string {
  return `/v1/user-inputs/${encodeURIComponent(inputId)}`
}

export const DRAGON_SESSION_RESUME_TEMPLATE = '/v1/sessions/{id}/resume-thread'
export function dragonSessionResumePath(sessionId: string): string {
  return `/v1/sessions/${encodeURIComponent(sessionId)}/resume-thread`
}

export const DRAGON_USAGE_PATH = '/v1/usage'
export const DRAGON_USAGE_TEMPLATE = '/v1/usage'

/** Thread mode shared with the Dragon contract. */
export type DragonThreadMode = 'agent' | 'plan'

const THREAD_MODES: ReadonlySet<DragonThreadMode> = new Set<DragonThreadMode>(['agent', 'plan'])

export function isDragonThreadMode(value: unknown): value is DragonThreadMode {
  return typeof value === 'string' && (THREAD_MODES as Set<string>).has(value)
}

export function normalizeThreadMode(value: unknown): DragonThreadMode {
  return value === 'plan' ? 'plan' : 'agent'
}
