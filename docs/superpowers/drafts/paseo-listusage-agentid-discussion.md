# Expose agent-scoped usage reports to plugins

Status: recommendation accepted. API proposal: [Paseo #8503](https://github.com/getpaseo/paseo/pull/8503). Plugin migration: [ccstatusline #2](https://github.com/Laobei2012/paseo-ccstatusline/pull/2). Neither link implies that the API has shipped in a published release.

## Problem

ccstatusline shows context, 5-hour usage and weekly usage beside each agent. Routing plugins such as ZeroSub can run agents of the same provider under different accounts. The existing `paseo.providers.listUsage()` returns provider-shaped entries without agent attribution. Multiple entries can have the same provider ID. Its combined `displayName` is insufficient to associate a report with the current launch.

The daemon already accepts `agentId` in `usage.list_reports.request`, and its low-level client exposes `listUsageReports({ agentId })`. The public plugin SDK needs an agent-scoped method and a lifecycle signal to keep its results current.

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Add `agentId` to `providers.listUsage()` | Small migration for existing callers | Must route to the newer request and convert native reports into the compatibility shape |
| Add `agents.ref(id).listUsageReports()` | Agent scope is explicit; preserves report, source and account identity | Callers migrate to native `reports[]` |

The second option is accepted. The server explicitly calls the old adapter `listLegacyUsage()` and marks it `COMPAT(providerUsageList): added in v0.1.98, remove after 2027-03-26`. It converts native reports into the old response. This is evidence for calling it a legacy compatibility API, not a guarantee of a removal release. See [usage source registry](https://github.com/getpaseo/paseo/blob/main/packages/server/src/server/plugins/usage-sources/index.ts).

## Proposed contract

```ts
paseo.agents.ref(agentId).listUsageReports({ forceRefresh: true })
// { requestId, reports: UsageReportEntry[], usageRevision: string | null }
```

- Agent snapshots expose the same opaque `usageRevision`. It identifies launch attribution without exposing the session environment or credentials.
- The daemon advertises `agentUsageRevision`. The SDK rejects unsupported hosts instead of returning host-wide reports.
- Reload/resume that replaces a provider launch changes the revision even when the agent ID and public conversation ID remain the same. No live usage session has a null revision and no attributed reports.
- A request spanning an attribution change fails; the client discards partial streamed results.
- Reports describe account quotas associated with the launch, not tokens consumed by the agent alone. Zero, multiple and unavailable reports remain possible.

## Plugin behavior and ZeroSub

The plugin caches usage per host and agent. It clears old attribution and requests again after revision changes, turn starts, reconnect snapshots and panel opening; it also polls every 60 seconds. Each invalidation replaces the pending-request identity so earlier responses cannot restore an old account. A response whose revision differs from the observed agent snapshot is discarded. Missing support, failed requests or ambiguous reports hide account usage without disabling other status widgets.

Source inspection of ZeroSub shows two relevant paths: an established Codex task continues in a new or reused account-bound agent, or an eligible same-agent switch reloads the provider session with a selected `CODEX_HOME`. These give either a different agent ID or a new launch revision. A deferred switch must retain the running account until it completes. Merely replacing credentials inside a continuing provider launch is outside this contract.

An isolated local integration check with a real Codex app-server, the real Codex usage source and two accounts passed initial attribution, same-agent reload, revision delivery, stale-response rejection, separate continuation attribution and reused continuation refresh. This exercised the real plugin store with SDK responses. The routing hook was a test fixture, not ZeroSub's UI or handoff prompt; browser rendering was not exercised. The same-agent test copied rollouts between temporary account homes, which ZeroSub does not do for Codex. This verifies the API/store behavior without claiming an end-to-end ZeroSub UI switch.

The plugin keeps a small optional-method type bridge against the published 0.14.0 SDK until the new API is released. Older hosts/apps hide account usage and never fall back to the default host account.
