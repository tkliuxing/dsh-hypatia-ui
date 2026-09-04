/**
 * Host loader entry for `dsh-hypatia-ui`.
 *
 * The Host half owns the `hypatia` CLI: it serializes every invocation
 * (Hypatia's shelf store admits one process at a time), exposes the console's
 * reads and its one guarded write under `/api/dsh-hypatia`, and optionally
 * tells the agent that the console exists. The browser half is a same-origin
 * view over these routes and holds no authority of its own.
 *
 * This package is deliberately independent of `dsh-hypatia` (the memory-skills
 * and auto-approval bundle): the two compose, and neither needs the other.
 *
 * @module @tkliuxing/dsh-hypatia-ui
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-system-prompt'
import z from 'schemastery'
import { HypatiaCli } from './host/hypatia-cli.ts'
import { makeHypatiaRoutes } from './host/routes.ts'
import { HypatiaService } from './host/service.ts'

export type {
  DeleteRequest, DeleteResponse, GraphEdge, GraphNode, GraphNodeResponse,
  HealthResponse, Impact, Knowledge, KnowledgeContent, KnowledgePage,
  Relationship, Shelf, ShelvesResponse, Statement,
} from './protocol.ts'
export { HYPATIA_API_PREFIX } from './protocol.ts'

/** Order within the 100–199 tool-guidance band. */
const SECTION_ORDER = 190

/** Model-facing announcement, registered only when `announceToAgent` is on. */
export const HYPATIA_UI_GUIDANCE = '本机已安装 dsh-hypatia-ui 插件（DSH Web GUI 的 Hypatia 知识库控制台）：侧边栏「Hypatia 知识库」入口，点击后在主界面打开。能力：浏览已注册的 shelf；用 Hypatia 的 JSE 全文检索并按 tag / scope 过滤；查看知识条目的完整内容（Markdown 渲染）与全部正反向 statement；以局部图谱查看一个实体的直接关系并逐点展开；删除前预览影响面，需重新键入条目名确认，并可选择一并删除相关 statement。所有操作都通过本机 hypatia CLI 串行执行，不经过网络。用户提到「知识库 / 记忆库 / Hypatia 面板 / 知识图谱」时通常即指本插件。'

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /** Master switch: off unregisters the routes and the browser surfaces. */
  enabled?: boolean
  /**
   * When true, a system-prompt section announces the console to every agent.
   * Off by default — the console is a human surface and costs prompt tokens.
   */
  announceToAgent?: boolean
  /**
   * `hypatia` executable. Absolute path, or a name resolved through PATH.
   * Falls back to `$HYPATIA_BIN`, then `hypatia`.
   */
  binary?: string
  /** Per-invocation timeout in milliseconds. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  announceToAgent: z.boolean().default(false),
  binary: z.string(),
  timeoutMs: z.natural().default(20_000),
})

/**
 * Required services (fiber inject waiting — both must be up before `apply`).
 * `systemPrompt` is a base-composition service and is listed unconditionally
 * so a deployment that turns the announcement on later needs no reload.
 */
export const inject = ['webServer', 'systemPrompt']

/**
 * Mount the Host half.
 * @param ctx - the plugin context.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export function apply(ctx: Context, config?: Config): void {
  if (config?.enabled === false) return

  const cli = new HypatiaCli({
    ...(config?.binary === undefined ? {} : { binary: config.binary }),
    ...(config?.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs }),
  })
  const service = new HypatiaService(cli)

  ctx.effect(() => {
    const disposers: Array<() => void> = []
    try {
      for (const route of makeHypatiaRoutes(service)) disposers.push(ctx.webServer.register(route))
    } catch (error: unknown) {
      // A route collision must not leave half a family registered.
      for (const dispose of disposers) dispose()
      throw error
    }
    return () => { for (const dispose of disposers) dispose() }
  }, 'dsh-hypatia-ui: routes')

  if (config?.announceToAgent === true) {
    ctx.effect(
      () => ctx.systemPrompt.section({
        name: 'dsh-hypatia-ui:announcement',
        order: SECTION_ORDER,
        text: HYPATIA_UI_GUIDANCE,
      }),
      'dsh-hypatia-ui: announcement',
    )
  }
}
