# Agent Runtime Notes

Sino Code has one live agent runtime: **Dragon**.

Do not add a second live provider, provider switcher, runtime diagnostics panel,
or legacy CodeWhale/Reasonix process path. Code, Write, and Connect phone all
enter the same Dragon HTTP/SSE boundary. Connect phone still uses the internal
`claw` name in code for compatibility.

## Allowed Extension Path

1. Add protocol fields in `Dragon/src/contracts/`.
2. Add agent behavior in `Dragon/src/loop/`, `Dragon/src/services/`, or a
   new port/adapter under `Dragon/src/ports/` and `Dragon/src/adapters/`.
3. Add HTTP endpoints under `Dragon/src/server/routes/`.
4. Map the endpoint/event in `src/renderer/src/agent/Dragon-runtime.ts` and
   `src/renderer/src/agent/Dragon-mapper.ts`.
5. Add settings only under `agents.Dragon`.

## Forbidden Paths

- No `AgentSwitcher`.
- No `ConnectionStatusBar`.
- No `RuntimeDiagnosticsDialog` or runtime self-check UI.
- No CodeWhale/Reasonix adapter, process manager, RPC bridge, updater, or
  importer.
- No drawing/design starter card in the core workbench.
- No `/usage` or `/runtime` slash command that opens a runtime control panel.

## Legacy Data Rule

Old persisted keys may be read only inside settings migration:

- `agentProvider: codewhale | reasonix | deepseek-runtime` maps to `Dragon`.
- `agents.codewhale`, `agents.reasonix`, and legacy `deepseek` values seed
  `agents.Dragon` once.
- Saved settings must contain only `agents.Dragon`.
- Old Connect phone (internal Claw) `agentThreadIds.codewhale/reasonix` fold into
  `agentThreadIds.Dragon`.

## Verification

Run:

```bash
npm run typecheck
npm test
npm run build
```

Manual smoke:

- Code can create a Dragon thread, stream a reply, approve/deny tools, and
  interrupt a turn.
- CodeWhale parity endpoints still work through Dragon: thread search/archive
  filters, fork, session resume, request_user_input submit/cancel, and usage.
- Cache telemetry uses DeepSeek native `prompt_cache_hit_tokens` /
  `prompt_cache_miss_tokens`; hot Dragon turns should stay above 90% cache
  hit after the stable prefix is warm.
- Immutable prefix drift and malformed tool-call/tool-result history must be
  caught before a request reaches the model API.
- Write can open the workspace, request inline completion, and use selected-text
  assistant actions.
- Connect phone can save settings and run a manual task through a Dragon thread.
- Settings -> Agents shows only Dragon.

The full plan is in
[`docs/Dragon-architecture.md`](./Dragon-architecture.md).
