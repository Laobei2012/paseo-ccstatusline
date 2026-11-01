# paseo-ccstatusline

Shows ccstatusline-style status information in Paseo agent composer pills. Requires Paseo 0.14.0 and uses its standard plugin APIs; no local Paseo host patches are required.

Click a status pill to open the Text/Colored view. The selected view is remembered until the plugin or app reloads. Long rows share horizontal scrolling.

## Known issues on the standard host

- Hover uses the host's plain-text tooltip. Interactive Colored hover and a shared Text/Colored hover panel require a host API that is not available in standard Paseo 0.14.0. The click-open panel remains available.
- The public usage API returns host-wide provider reports, without agent-specific account attribution. With multiple matching accounts, the plugin cannot safely choose one and hides the account and usage values. Even a single report is a provider usage source, not proof of the agent's active account, especially with account-routing plugins.
- Empty rows are omitted. A five-row configuration can therefore display only four rows when its usage-only row has no available data. There is no four-row display limit.
- On compact screens, the host sheet can repeat the long tooltip title above the content. This layout issue remains unresolved.

## Local host patches removed

The experimental interactive-hover and agent-attributed usage SDK patches were reverted. Their implementation remains in Git history for reference. The installed renderer is restored from its original asset backup; reload the main Chat pane to activate it. No daemon changes or restart are required.

## Development

Run `npm test` and `npm run typecheck`. See [OVERVIEW.md](OVERVIEW.md) for plugin behavior and the documents under `docs/` for design history; historical experiments can describe APIs that are no longer used.
