# Attributed usage and complete status rows

The local deployment had five configured rows but displayed four for an agent using Codex. The host-wide legacy usage endpoint returned two available Codex account reports. The existing ambiguity rule correctly suppressed both account identity and usage windows; the fourth configured row contained only usage widgets and therefore became empty. This was not clipping or a fixed four-row limit. The same selection behavior existed before the hover integration.

The daemon's agent-scoped reports returned exactly one available report with a real account label and both five-hour and weekly windows. The plugin now uses that existing account attribution through the public `providers.listUsageReports({ agentId })` API. It never chooses the first host-wide report. A single scoped report may come from a different source than the agent harness, such as Codex usage for Pi; multiple reports remain ambiguous. ZeroSub retains its explicit native-account exclusion. Account labels and source labels remain separate: a missing account label shows “Usage source” rather than inventing an account identity. Unavailable, failed and absent reports clear current account/windows; prior successful usage is not presented as current.

Each agent owns its usage cache and sixty-second polling timer. A new agent is queried immediately, independently of other pending requests. Provider changes, public session changes, new turns and transitions into running invalidate the cache and permit immediate revalidation, including inside the ordinary polling interval. Old pending results cannot overwrite a replaced cache. Removal and stop release timers and invalidate pending ownership.

The daemon's private launch usage-session key is not in the public agent snapshot. A launch/account reroute that produces no observable provider/session/turn/status change cannot be invalidated immediately. It is discovered on the next successful sixty-second poll; this is not a claim of instant detection for every account switch. Normal hover and press mounts share the same per-agent polling limit, with the lifecycle invalidations above as explicit exceptions.

## Reproduction and regression checks

The unit reproduction initially failed with four populated rows instead of five and no account when two same-provider reports were returned globally. The fixed test queries two agents independently and checks their distinct account labels and all five populated rows. Other tests cover delayed old-session and same-thread/new-turn responses, removal/readdition, off-grid polling deadlines, cleared attribution and failures, source-label fallback, cross-harness sources, ambiguity and ZeroSub.

The [browser regression template](assets/hover/status-usage.spec.ts.txt) uses the real plugin client and an isolated daemon with a deterministic usage source. Its global discovery returns two fixture accounts; session discovery returns one. It asserts that boundary before opening the actual hover UI, then checks the account and five complete rows, including the bottom row's geometry, in Text/Colored, hover/press and compact fallback. No real credentials or user account identities are embedded in the fixture.

Copy the template to the matching host's `packages/app/e2e/browser/status-usage.local.spec.ts` and run from the host worktree:

```sh
CI=1 E2E_WORKERS=1 \
  CCSTATUSLINE_HOVER_SOURCE=/tmp/paseo-ccstatusline-hover-integration \
  PLAYWRIGHT_BROWSERS_PATH=/tmp/paseo-hover-browsers \
  EXPO_HOME=/tmp/paseo-hover-expo EXPO_NO_TELEMETRY=1 \
  npm_config_cache=/tmp/paseo-hover-npm-cache \
  npm run test:e2e --workspace=@getpaseo/app -- \
  e2e/browser/status-usage.local.spec.ts --retries=0
```

The matching patched client SDK must be built first and available for plugin typechecking. As with the earlier local browser check, the temporary daemon harness requires process-identity access outside the sandbox. The tests do not restart the installed daemon or change live settings.
