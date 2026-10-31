# Draft: let plugins read usage for one agent

Status: draft. Not published.

Title: Let `providers.listUsage()` take an agent ID, so plugins can show the right account

## What I am trying to do

I am building a plugin that shows a per-agent status summary in a composer pill: context, 5-hour usage and weekly usage. I use an account-switching plugin (ZeroSub), so agents of one provider can run under different accounts.

## How I do it today

The plugin calls `paseo.providers.listUsage()`. The result has one entry for each provider, with no link to an agent. The plugin shows the `displayName` beside the numbers, but it cannot tell if that account is the agent's account.

## Where Paseo gets in the way

The daemon already has what I need. `usage.list_reports.request` takes an optional `agentId`, and the app uses it for the usage cards in the agent's context window details. The SDK option type has only `requestId`, so plugin code cannot make this request.

## What would be better

One of these:

1. An `agentId` option on `providers.listUsage()`.
2. A new SDK method that returns the reports for one agent, for example `paseo.agents.ref(id).usage()`.

The second keeps the old legacy response shape out of the new path. Either one removes the need to guess, and other plugins that show per-agent usage can use it too.
