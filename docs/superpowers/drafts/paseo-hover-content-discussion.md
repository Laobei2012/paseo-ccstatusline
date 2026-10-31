# Draft: custom hover content for plugin buttons

Status: isolated host implementation and plugin integration in progress, not published or deployed. Checked 2026-10-31. The original installed plugin remains on its compatible branch.

## Requested behavior and current dependency

Simon requested that the status pill's hover view remember the last selected text or colored view. The released app exposes only text tooltips. This development integration uses a new optional public hover descriptor and a shared Text/Colored selector. Every configured row stays on one line, and all rows share one horizontal scroller.

The public contract cannot implement colored hover content today:

- The [deployed button contract](https://paseo.sh/docs/plugins/reference.md#button-descriptor) exposes `title` as tooltip text and only action, menu and popover behaviors. The custom icon section says that the host owns all pointer interaction.
- Pinned `@getpaseo/plugin` 0.14.0, `dist/client/buttons.d.ts`: `PluginButton.title` is text; popover behavior exposes `Content`, but no hover trigger or custom tooltip field. Registrations expose only `update()` and `remove()`, with no way to open content programmatically.
- Host reference checkout at `a4f696620`, `packages/plugin/src/client/buttons.ts`: the same limits apply, including with localized `PluginText`.
- `packages/app/src/plugins/buttons/view.tsx`, `ButtonIcon`: the icon wrapper has `pointerEvents="none"`. The button renderer puts `button.title` inside a `Text` in `TooltipContent`; custom content is rendered inside `PluginPopoverSurface` after opening the button.
- `packages/app/src/plugins/popover.tsx`, `PluginPopoverSurface`: the host caps the surface at 420 pixels wide. Horizontal scrolling is necessary for long unbroken rows.

This is a host API dependency. Replacing the long tooltip with shorter text, nesting pointer handlers in the icon, importing `/client/host`, or accessing host DOM does not satisfy the request through the public SDK.

## Minimal proposed API

Add one optional field to `PluginButton`, separate from press behavior:

```ts
hover?: { Content: React.ComponentType<PluginButtonContentProps> };
```

The field is implemented only in the isolated host worktree, not the released app. Omission preserves today's plain-text tooltip. Supplying it replaces only the desktop hover body; `title` remains the accessible label and sheet title. It does not change the press action. Content receives the same host, theme, layout, context and `close()` capabilities as press content.

The host owns anchoring, bounds, dismissal, error containment and installation context through `HoverCard`. Content mounts only while open. It permits pointer movement from trigger into content, horizontal scrolling, and use of controls without dismissal. Keyboard focus exposes the same preview; Arrow Down enters its first focusable control. Enter/Space preserve the pill's press behavior. Escape restores focus to the pill only when focus was inside the preview; unrelated focus stays put. Pressing the trigger closes the preview before running the existing press behavior. Compact/touch clients keep the press-opened surface and have no hover preview. Pane/workspace navigation, trigger disappearance, removal, hiding, disabling, host disconnect and plugin teardown dismiss the preview and unmount its body.

Descriptor updates to label/title must not reset an open custom body's state. Replacing the hover component closes the preview. Existing behavior-update closing semantics remain unchanged. The plugin owns mode selection; the host does not store plugin-specific text/colored modes.

## Exact host work

Paths below are relative to the isolated host worktree `/tmp/paseo-plugin-hover-content`, branch `simon/plugin-hover-content`, based on clean reference `main` at `a4f696620`. The reference checkout is unchanged.

1. `packages/plugin/src/client/buttons.ts`: declare the optional hover descriptor using existing exported content props. The existing `client/index.ts` exports already expose `PluginButton`; no new runtime module is needed.
2. `packages/app/src/plugins/buttons/validation.ts`: validate the optional descriptor and component on registration and update, preserving atomic validation failures. Retain translated title handling.
3. `packages/app/src/plugins/buttons/model.ts`: own preview closing rules on update/removal, coordinating preview and press-opened surface state. Keep ordinary title/label updates from unmounting a stable hover component.
4. `packages/app/src/plugins/buttons/view.tsx`: render the optional body in a host-owned hover surface under `ButtonEnvironment`, with the contextual props and error boundary used for press content. Suppress the old text tooltip and prevent competing surfaces. Use the host's documented hover/floating-panel patterns; do not route pointer events through the icon.
5. `packages/app/src/components/ui/hover-card.tsx`: add controlled open/onOpenChange, keyboard entry through a focusable descendant, and conditional Escape focus restoration. The button renderer reuses existing popover content padding/providers and bounds; no change to `plugins/popover.tsx` is required. `PluginHeaderButtons` receives route activity from `screens/workspace/workspace-screen.tsx`; composer pills use pane focus and retained-panel activity.
6. `packages/app/src/plugins/buttons/model.test.ts`: cover update validation, preview lifecycle, removal and press coordination. Add renderer interaction coverage beside the button renderer for hover/focus, pointer travel, scroll, Escape, compact behavior and installation context. Check `docs/hover.md` and `docs/floating-panels.md` before choosing host primitives.
7. `public-docs/plugins/reference.md`: document the field, replacement tooltip behavior, interactive preview, focus, lifecycle and mobile fallback. Update `docs/plugins.md` if its maintainer examples describe the old limitation as universal.

No daemon protocol, usage transport or OAuth changes are needed. Local adoption requires matching patched SDK and app sources, not a public release. Public adoption must raise `requirements.paseo` to the actual supporting app release.

## Plugin follow-up once supported

The isolated plugin worktree `/tmp/paseo-ccstatusline-hover-integration`, branch `simon/paseo-ccstatusline-hover`, uses one stable custom content component for hover and press. Its Text/Colored selector stores selection outside the component. The preference is shared across agents in one client contribution lifetime. Closing/reopening either surface preserves it; plugin/app reload resets it to Text. No preference is persisted to disk, and existing agent-specific values and usage account attribution stay in both views.

The integration manifest targets `0.14.0-hover-content.0` deliberately. This is a reserved local development target, not an assertion that a supporting version has shipped. It prevents accidental installation on released 0.14.0. Do not install or reload this branch against the live app. For an isolated test with matching patched app/SDK, use a temporary fixture copy with requirements matching that development app; do not alter the running app's version or configuration. Before public adoption, replace the development requirement with the actual supporting release and pin its published SDK.

To typecheck locally, build the host SDK, use `npm pack --workspace=@getpaseo/plugin --ignore-scripts --pack-destination /tmp`, then install that tarball into this worktree with `npm install --no-save --package-lock=false --ignore-scripts /tmp/getpaseo-plugin-0.14.0.tgz`. Packing avoids resolving a linked SDK's separate React Native type tree. The checked-in dependency remains the release pin until a supporting SDK version is assigned.

Both modes keep one horizontal scroller for the configured rows; title, account attribution, errors and hidden-widget explanation stay outside. Text mode uses the existing plain text formatter; colored mode uses `SegmentRow`. Opening custom hover content must acquire and release the same store observation lifecycle as the press popover, so timeline reads stop on close.

## Acceptance checks

- Change Text to Colored, dismiss, hover again, then press: all surfaces use the selected mode. Repeat in the reverse direction and after live pill updates. Check the agreed preference scope when switching agents and hosts.
- Hover and keyboard focus mount the correct installation/agent content. Leaving both trigger and preview, Escape, pressing, disconnecting and removing the plugin clean it up. Touch opens only on press.
- Spaced and unbroken long rows scroll together; neither edge clips Powerline separators. Title, account, errors and explanations stay outside the row scroller. Verify compact layout, native horizontal gestures and both themes.
- Keep lifecycle and layout tests, but record actual app screenshots/interaction evidence separately. Current passing tests do not prove these visual checks.

## Review and validation record

Independent review reported `8b66541` and `0c7904a` OK to keep, with no proven layout regression. The missing popover structure assertion is added in `test/popover-layout.test.ts`: every nonempty row has the same single horizontal scroll ancestor, and all explanatory text has no such ancestor. This complements the segment-level tests; it does not exercise Yoga, browser layout or native gestures.

Targeted plugin checks: view-mode (1), pills (4), popover-layout (2) passing; `npm run typecheck` passes against the packed patched SDK. Host checks and browser evidence are reported with the host implementation. No live reload or deployment was performed. Actual plugin desktop and native visual checks remain pending.
