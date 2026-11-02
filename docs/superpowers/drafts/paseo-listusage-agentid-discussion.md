# Let plugins read account usage for an agent and detect provider launch changes

Draft for GitHub Discussions, category: **Ideas**. Not posted.

## What are you trying to do?

I maintain [paseo-ccstatusline](https://github.com/Laobei2012/paseo-ccstatusline), a plugin displaying session information and account quotas. Its reports should follow the account used by an agent after another plugin switches accounts or resumes work.

For example, ZeroSub moves a Claude conversation to another account in place. It reopens the session with `paseo agent reload`, and the agent ID stays the same, so the ID does not show the change. A Codex switch is different. ZeroSub continues the task in another agent, so the plugin only needs that agent's reports.

These are ZeroSub's documented [switching behaviors](https://github.com/kapybara-org/zerosub#claude-vs-chatgpt-when-switching-mid-conversation). Reports describe account quotas, not consumption attributable exclusively to an agent.

## How do you do it today?

The high-level SDK exposes `providers.listUsage()` without an agent option. Selecting a host-wide entry by provider cannot reliably identify an agent's account when several accounts use that provider.

The daemon already accepts `agentId` in `usage.list_reports.request`. Plugins need supported high-level access to those native reports, plus a signal to discard reports when the provider launch changes under the same agent ID.

## Where does Paseo get in the way?

Agent-scoped queries solve selection across different IDs. They do not tell a plugin when to clear a cached result for the same ID. Polling leaves a window where the previous login's quota appears current, and delayed responses can arrive after reload.

The existing app's [usage query handling](https://github.com/getpaseo/paseo/blob/bfac1329204f9aaeb6d47742885c51551d64f70b/packages/app/src/usage/queries.ts) already notes this: a resumed agent retains its ID but can use another login, so it drops reports when the details close.

## What would a better workflow look like?

A plugin requests native account reports for its agent, observes a launch revision, and discards reports when that revision changes. Routing stays in plugins such as ZeroSub; display and refresh scheduling stay in the consuming plugin.

This preserves the account-level model. [#5685](https://github.com/getpaseo/paseo/pull/5685) removed agent-tied usage and the composer pill, explaining that “Usage is an account-level fact”. [#5975](https://github.com/getpaseo/paseo/pull/5975) subsequently added account reports associated with an agent's launch to its context window details. This proposal exposes that relationship to plugins. It does not ask for a pill in core.

## Possible API and contract

[PR #8503](https://github.com/getpaseo/paseo/pull/8503) is a reference implementation:

```ts
const result = await paseo.agents.ref(agentId).listUsageReports();
// { requestId, reports: UsageReportEntry[], usageRevision: string | null }
```

`usageRevision` identifies the provider launch and model. It also changes on a same-account reload or a model switch. A change means that the plugin must discard its reports and fetch again. It does not mean that the account changed, and the value does not identify an account.

- Agent snapshots expose the same opaque revision. No live usage session means a null revision and empty reports; reading a stored agent does not reopen it. Unknown IDs reject.
- Native reports retain source and account identity. Zero, multiple, and unavailable reports are possible. There is no host-wide fallback.
- Requests spanning a revision change reject, including same-account reloads and model switches. The current PR only returns an error string. A stable machine-readable error code remains an outstanding contract improvement, so plugins can distinguish stale requests without matching prose.
- The host's **Check usage** switch remains authoritative. When off, requests reject before discovery or vendor calls, as documented in the [plugin guide](https://github.com/getpaseo/paseo/blob/bfac1329204f9aaeb6d47742885c51551d64f70b/docs/plugins.md). Plugins should respect that setting rather than repeatedly retrying or querying vendors themselves.
- Ordinary reads use the daemon's five-minute cache. `forceRefresh` bypasses it and should be reserved for an explicit refresh, not routine polling.
- `features.agentUsageRevision` advertises support. Existing provider-wide APIs stay unchanged. Credential edits within an unchanged launch are not detected.

Extending `providers.listUsage({ agentId })` is an alternative. I favor the agent method because scope is explicit and native report identity is preserved. Naming and placement remain open for discussion.

## Evidence and limits

The completed tests demonstrate distinct behaviors:

1. A macOS Codex fixture tested same-agent reloads, revision delivery, and stale-response rejection with two accounts. It used a test routing hook and copied rollouts between temporary account homes. ZeroSub does not switch established Codex conversations this way. This verifies API/store behavior, not ZeroSub's in-place switch.
2. A separate test installed unmodified ZeroSub 1.5.0 and called its actual account-switch RPC with Codex. A→B created a continuation and B→A reused the original agent. Reports and ccstatusline state followed each account. This tests different-agent selection, not the same-ID case motivating the revision. It did not click the ZeroSub UI.
3. Regression tests cover lifecycle/finish notification preservation during reload and empty reports for stored agents without reopening them.

**ZeroSub's Claude same-ID account switch has not been tested with this API.** That workflow is supported by source inspection, not live verification. A two-account Claude run should verify the unchanged agent ID, revision transition, new account report, and rejection of a delayed pre-switch response before claiming end-to-end coverage. Other platforms and providers remain unverified. PR #8503 records the existing test details.

## Related needs and questions

[#3589](https://github.com/getpaseo/paseo/issues/3589) reports missing usage for non-default account configuration directories. [Discussion #3463](https://github.com/getpaseo/paseo/discussions/3463) requests usage for several custom Codex accounts. Both demonstrate multi-account use, but request first-party display, not a plugin API.

ccstatusline supplies one concrete plugin use case. Feedback from the ZeroSub maintainer would help establish another plugin author's need; no endorsement is claimed here.

Would this extension point help other plugin authors? Is a launch revision on snapshots the right invalidation mechanism, or would a dedicated event fit better? What stable error contract should distinguish a request invalidated by a launch change?
