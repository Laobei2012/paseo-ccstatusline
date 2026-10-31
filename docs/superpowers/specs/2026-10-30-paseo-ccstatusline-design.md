# paseo-ccstatusline design

## Intent

Simon uses `ccstatusline` in Claude Code and wants the same view for agents in Paseo. The view must work for all providers and must change with the selected agent.

`paseo-ccstatusline` is a Paseo plugin. It reads the layout from the `ccstatusline` configuration file. It gets all values from Paseo and the daemon machine. It does not run `ccstatusline`.

The approved interaction is in `assets/composer-pill-prototype.html`. Open that file in a browser to see it.

## Goals

1. Show a composer pill for each agent, with three numbers: context, 5-hour usage and weekly usage.
2. If the user hovers over the pill, show all configured status lines as plain text.
3. If the user presses the pill, show all configured status lines with colors.
4. Use the line order, widget order and colors from `~/.config/ccstatusline/settings.json` on the daemon machine.
5. Work for every provider. A value that a provider does not report must not stop the rest of the view.

## Non-goals

- A view that stays fully visible beside the chat. Simon accepted a summary with hover and press. This needs a Paseo source change, so it is out of scope.
- Changes to the Paseo source.
- Editing the `ccstatusline` configuration from Paseo.
- A layout tuned for phones. Only desktop is required. The pill can still appear on a phone.
- Publishing to npm, GitHub or the Paseo plugin registry. Publishing needs separate approval from Simon.

## Anti-goals

Each of these items is a failure, also for a view that looks correct:

- The plugin edits Claude Code configuration, or adds hooks to it.
- The plugin reads OAuth tokens, or sends data outside the daemon machine and the connected Paseo clients.
- The plugin writes to `~/.config/ccstatusline/settings.json`.
- The plugin shows values from another agent or provider without saying so. A wrong value is worse than a hidden one. There is one approved exception, in the usage rules.
- Frequent updates slow the chat, for example a pill update for every streamed token.
- A Paseo daemon restart is part of the install or test steps. A restart stops all running agents.

## Constraints

- The target is the installed Paseo 0.14.0. The app updated from 0.13.2 during this work. The local checkout at `/Volumes/WDSN580/src/paseo-work/paseo` is only a reference. Make sure that each API used exists in 0.14.0. Set `requirements.paseo` to `>=0.14.0`.
- Follow the plugin file rules: `index.client.tsx` and `client/` for the app, `index.server.ts` and `server/` for the daemon, and `shared/` for both. Client code must not use Node APIs.
- Use React Native primitives and `theme.colors` for Paseo interface colors. Only status segments use colors from the status line theme.
- A pill label is one line of muted text in a pill that is at most 160 pixels wide. A pill icon area is 16 by 16 pixels.
- Tooltip text comes from the button `title`. Paseo also uses `title` as the accessibility label and the phone sheet title. Paseo docs say that custom content does not open on hover.
- `PluginAgentSnapshot` from `useAgent` has no `lastUsage`. Read usage through the client SDK agent records.
- The SDK `providers.listUsage()` option has no agent ID.

## Design

### Pill

The plugin registers one pill with `client.addComposerPill` for each non-archived agent that has a `workspaceId`. It follows the pattern in `plugin-examples/local-plugin/client/main.tsx`: an owned `client.paseo.agents.list({ subscribe: {} })` subscription, a registration map, and cleanup on plugin stop.

The label is `74% · 63% · 39%`, in this fixed order: context, 5-hour usage, weekly usage. Simon chose three numbers without labels. If a number is missing, show `--` in its position so that the order does not change. Round each number to a whole percent.

The custom icon draws a small horizontal bar that shows context use. Draw to the `size` prop, because composer pills pass 14. The icon reads its value by `agentId` from a plugin store.

The pill behavior is `popover`.

### Hover

The `title` holds one plain text row for each configured line. Segments in a row are separated by ` | `. The rows use the same hidden-widget rules as the popover.

Simon tested this in the real tooltip on Paseo 0.14.0. All rows are visible, and long rows wrap. Simon accepted this result, so `title` holds all rows. The first row is the account row from the usage rules, if an account name is known.

### Popover

The popover shows the agent title and then one row for each configured line. Each configured line stays on one row and never wraps. All segment rows sit together in one horizontal scroll area, so they scroll sideways together. The title, usage account row, settings error and hidden-widgets line stay outside that area and can wrap. Each segment shows the widget text in monospace. Powerline separators are drawn as `View` shapes or with another method that does not need a Powerline font.

### Configuration

A server RPC reads the configuration file on the daemon machine, parses it with Zod, and returns the fields that the client needs: `lines`, each widget `type`, `color`, `backgroundColor` and `rawValue` where present, plus `colorLevel`, `globalBold`, and `powerline`. Unknown fields, including `merge`, are ignored. The RPC checks the file modification time on each call, so a saved change appears without a plugin reload.

If the file is missing or invalid, the pill still shows its three numbers. The popover shows a one-line message with the path and the reason.

Colors follow `ccstatusline` 2.2.33. When `powerline.enabled` is true and a built-in theme is selected, segments take their colors from that theme, not from the widget `color` fields. `colorLevel` selects the theme variant. The color sequence restarts on each line because `continueThemeAcrossLines` is false in Simon's file. If that field is true, continue the sequence across lines. A hidden widget does not use a color slot, so later segments move up in the sequence.

Copy the built-in theme table from `ccstatusline` 2.2.33 and include its MIT license notice. Convert named colors, `ansi256:` colors and `hex:` colors to hex for React Native. When Powerline is off, use the widget colors and a plain separator.

With Simon's file, a Claude agent with all values present has this layout. The numbers are an example from one `ccstatusline` run, and the token numbers will differ. See the token rules.

```text
Model: Opus 5.5 > Context: [████████████░░░░] 147k/200k (74%) > ⎇ main
cwd: /Volumes/WDSN580/src/paseo-work/paseo > Mem: 7.1G/16.0G
Cached: 2.8M > In: 52 > Out: 22.7k > In: 0.2 t/s > Out: 100.4 t/s > Total: 100.6 t/s
Reset: 2hr 27m > 5h: 63.0% > Weekly Reset: 4d 20hr 7m > Weekly: 39.0%
Thinking: high > Skill: superpowers:brainstorming > Style: simple-english
```

The first segment on each line is `ansi256:131` with text `ansi256:231`. The later segments continue through 220, 68, 108 and 176, with text 16, 231, 16 and 16, and they then repeat. The hex values are in this list:

- 131: `#af5f5f`
- 220: `#ffd700`
- 68: `#5f87d7`
- 108: `#87af87`
- 176: `#d787d7`
- 231: `#ffffff`
- 16: `#000000`

Match the `ccstatusline` 2.2.33 text format for each widget. Read its package source for these formats. Simon's file uses `rawValue` nowhere today. Support of `rawValue` is optional.

### Widget data

Support the 18 widget types in Simon's file. Any other type is hidden, and the popover shows one muted line with the hidden type names.

| Widget | Source | Provider notes |
| --- | --- | --- |
| `model` | Model label from the provider model list, then the raw model ID | All |
| `context-bar` | `lastUsage.contextWindowUsedTokens` and `contextWindowMaxTokens` | A missing value hides it |
| `git-branch` | server RPC, `git branch --show-current` in the agent `cwd` | Hidden outside Git |
| `current-working-dir` | agent `cwd` | All |
| `free-memory` | server RPC, same calculation as `ccstatusline` | Daemon machine |
| `tokens-cached` | `lastUsage.cachedInputTokens` | A missing value hides it |
| `tokens-input` | `lastUsage.inputTokens` | A missing value hides it |
| `tokens-output` | `lastUsage.outputTokens` | A missing value hides it |
| `input-speed` | Estimate from token changes | See speed rules |
| `output-speed` | Estimate from token changes | See speed rules |
| `total-speed` | Estimate from token changes | See speed rules |
| `reset-timer` | 5-hour usage window `resetsAt` | See usage rules |
| `session-usage` | 5-hour usage window `usedPct` | See usage rules |
| `weekly-reset-timer` | weekly usage window `resetsAt` | See usage rules |
| `weekly-usage` | weekly usage window `usedPct` | See usage rules |
| `thinking-effort` | agent `runtimeInfo.thinkingOptionId`, then `thinkingOptionId` | A missing value hides it |
| `skills` | last skill use in the agent timeline | See skills rules |
| `output-style` | Claude Code configuration file | Claude agents only |

Token rules: `ccstatusline` shows session totals, but Paseo `lastUsage` holds values from the last provider report, usually the last turn. The token widgets show the `lastUsage` values, with the same labels. The plugin does not sum them, because the source of each value differs between providers.

Speed rules: Paseo has no speed field. Keep the last token counts and time for each agent in the client. While the agent is running and the counts increase, speed is the token increase divided by the elapsed time. If a count decreases or no earlier sample exists, hide the speed. Paseo updates usage rarely during a turn, so speed is best effort and it is often hidden. Speed text is italic in the popover because it is an estimate.

Usage rules: call `paseo.providers.listUsage()`, and select the report with a `providerId` that matches the agent provider. The result has a `providers` array. Each entry has `providerId`, `displayName`, `status` and `windows`. The 5-hour window has the `id` `five_hour`, and the weekly window has the `id` `weekly`. Use only these window IDs. A provider with no match has hidden usage widgets and `--` in the pill. If a provider has more than one report, use `--` and hidden widgets, because the agent account is unknown through this API. Simon has the ZeroSub plugin, so this case is real. ZeroSub can also run an agent under a different account than the single report describes, and the plugin API cannot detect this. Simon approved this exception: the pill still shows the provider numbers, without a label. The hover text and popover show `Usage: <displayName>` in a separate muted row, so the source account is visible there. Simon also asked for a draft request to the Paseo maintainers, for an `agentId` option on `providers.listUsage()`. Publishing that request needs approval from Simon. If the option ships, use it and remove this exception. Refresh usage at most once each 60 seconds, and share one result among all pills.

Skills rules: the protocol has no skill timeline item. Claude timelines have a reliable shape: a `tool_call` item with `name` `Skill`, and the skill name in `detail.label` of a `plain_text` detail. The sampled Codex timeline has no reliable shape, so this widget is hidden for Codex. Read only the agent's recent timeline, only while its popover is open. Show the last skill that the timeline identifies. If a provider has no reliable shape, hide this widget for that provider. If a skill value is already known, the hover text includes it. Do not use `agent.commands()` for this widget, because it lists loaded skills and not used skills.

Output style rules: for agents with the `claude` provider only, a server RPC reads `outputStyle` with this order: `<cwd>/.claude/settings.local.json`, `<cwd>/.claude/settings.json`, then the user settings at `$CLAUDE_CONFIG_DIR/settings.json` or `~/.claude/settings.json`. Read no other fields. Show the text after the last `:`. This is the configured value, and a running agent can differ.

### Updates

- Agent records update pills through the subscription. Update each pill at most once each second. If the label, title and icon value are unchanged, skip the update.
- The branch, memory and output style RPC runs on one 30-second timer for each distinct `cwd`, and on popover open. The server caches results for 5 seconds.
- While a popover is open, it refreshes each 5 seconds. If the plugin stops or no agent uses a timer, stop that timer.
- A failed RPC keeps the last good value for 5 minutes and it then hides the widget. Log failures with `console.error`, without file contents.

### Structure

Keep formatting and data selection in pure TypeScript modules in `shared/`, so that tests do not need React Native or a daemon. Keep RPC contracts in `shared/`, file and process access in `server/`, and pills and popover components in `client/`.

## Verification

Each item is required before the final report:

1. Unit tests cover configuration parsing, invalid files, theme colors and the color restart on each line. They also cover all 18 widget formats, hidden values, `--` in the pill, speed rules and usage window selection. Use Simon's real file shape and the expected text above as a fixture.
2. `npm run typecheck` passes with `@getpaseo/plugin` at 0.14.0.
3. `client/` passes the DOM audit in the Paseo plugin skill.
4. `/Applications/Paseo.app/Contents/Resources/bin/paseo plugin install <absolute path>` succeeds, and `paseo plugin ls` shows `running` with no error. Use `paseo plugin reload paseo-ccstatusline` after changes. Do not restart the daemon.
5. On the desktop app, test a Claude agent and a Codex agent. Record screenshots of the pill, hover and press for each. Change tabs and make sure that the pill and popover show the selected agent. Save a change to a test copy of the configuration and make sure that the view updates. Do not edit Simon's real file for this test. Add a server environment override `CCSTATUSLINE_SETTINGS_PATH` only for this purpose.
6. `paseo plugin disable` and `paseo plugin enable` leave no pills and no timers behind while disabled.

## Choices left to the builder

- Timer structure, store design and component names.
- The way that the custom icon receives its value. Recreating the icon component on each update is not acceptable because it remounts.
- Popover width and row spacing inside the limits that Paseo sets.
- Separator drawing method.

## Decisions by Claude, not yet confirmed by Simon

- The plugin source is at `/Volumes/WDSN580/src/paseo-work/paseo-ccstatusline`, in a new local Git repository with no remote.
- The plugin ID and package name are `paseo-ccstatusline`. The license is MIT.
- Update intervals: 1 second for pills, 5 seconds for an open popover, 30 seconds for branch and memory, 60 seconds for usage.
- Accounts: more than one account report for a provider gives `--`, not a guess.
- Missing configuration: the pill stays and the popover shows a message.
- Skills: the widget reads the timeline only while the popover is open.
- Tokens: the token widgets show last-report values from `lastUsage`, not session totals.
- Model name: the label comes from the provider model list, with the raw ID as the fallback.
