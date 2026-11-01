# Expose agent-scoped usage reports to plugins

Status: recommendation accepted; API and plugin implementation in progress.

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

Live switching needs a separate local integration check; source inspection and unit tests alone do not establish that it works in the installed app. The plugin keeps a small optional-method type bridge against the published 0.14.0 SDK until the new API is released. Older hosts/apps hide account usage and never fall back to the default host account.
