# Draft: custom hover content for plugin buttons

Status: local design only, not published or implemented. Checked 2026-10-31.

## Requested behavior and current dependency

Simon requested that the status pill's hover view remember the last selected text or colored view. The plugin currently renders all rows in the plain-text tooltip, and colored rows in the press-opened popover. There is no text/colored mode selector in the current plugin. The existing no-wrap behavior must be preserved: every configured row stays on one line, and all rows share one horizontal scroller.

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

The field is a proposal, not an API plugins can use now. Omission preserves today's plain-text tooltip. Supplying it replaces only the desktop hover body; `title` remains the accessible label and sheet title. It does not change the press action. Content receives the same host, theme, layout, context and `close()` capabilities as press content.

The host owns anchoring, delay, bounds, dismissal, error containment and installation context. Mount the custom body only while open. It must permit pointer movement from trigger into content, horizontal scrolling, and use of the mode selector without dismissal. Keyboard focus should expose the same preview; Escape closes it without moving focus. Pressing the trigger closes the preview before running the existing press behavior. Hover must not run an action or open a compact sheet. Compact/touch clients keep the press-opened surface and have no hover preview. Removal, hiding, disabling, host disconnect and plugin teardown dismiss the preview and unmount its body.

Descriptor updates to label/title must not reset an open custom body's state. Replacing the hover component closes the preview. Existing behavior-update closing semantics remain unchanged. The plugin owns mode selection; the host does not store plugin-specific text/colored modes.

## Exact host work

Paths below are relative to the reference Paseo repository. No changes have been made there.

1. `packages/plugin/src/client/buttons.ts`: declare the optional hover descriptor using existing exported content props. The existing `client/index.ts` exports already expose `PluginButton`; no new runtime module is needed.
2. `packages/app/src/plugins/buttons/validation.ts`: validate the optional descriptor and component on registration and update, preserving atomic validation failures. Retain translated title handling.
3. `packages/app/src/plugins/buttons/model.ts`: own preview closing rules on update/removal, coordinating preview and press-opened surface state. Keep ordinary title/label updates from unmounting a stable hover component.
4. `packages/app/src/plugins/buttons/view.tsx`: render the optional body in a host-owned hover surface under `ButtonEnvironment`, with the contextual props and error boundary used for press content. Suppress the old text tooltip and prevent competing surfaces. Use the host's documented hover/floating-panel patterns; do not route pointer events through the icon.
5. `packages/app/src/plugins/popover.tsx`: reuse bounds and installation providers for the hover surface as appropriate. Keep one host surface with plugin-controlled horizontal row scrolling; do not wrap custom content in a noninteractive tooltip that prevents scrolling.
6. `packages/app/src/plugins/buttons/model.test.ts`: cover update validation, preview lifecycle, removal and press coordination. Add renderer interaction coverage beside the button renderer for hover/focus, pointer travel, scroll, Escape, compact behavior and installation context. Check `docs/hover.md` and `docs/floating-panels.md` before choosing host primitives.
7. `public-docs/plugins/reference.md`: document the field, replacement tooltip behavior, interactive preview, focus, lifecycle and mobile fallback. Update `docs/plugins.md` if its maintainer examples describe the old limitation as universal.

No daemon protocol, usage transport or OAuth changes are needed. Release the SDK and app contract before adopting it in this plugin; raise `requirements.paseo` to the actual supporting release.

## Plugin follow-up once supported

Use a stable custom content component for hover and press. Add an explicit Text/Colored selector, and keep its selected mode outside either component so unmounting/reopening or switching between hover and press does not reset it. Proposed scope is one preference per connected app installation, shared across agents; persistence across app restarts needs an explicit storage decision before implementation. Do not add persistence to ccstatusline or Claude settings. Existing agent-specific values and usage account attribution must stay in both views.

Both modes keep one horizontal scroller for the configured rows; title, account attribution, errors and hidden-widget explanation stay outside. Text mode uses the existing plain text formatter; colored mode uses `SegmentRow`. Opening custom hover content must acquire and release the same store observation lifecycle as the press popover, so timeline reads stop on close.

## Acceptance checks

- Change Text to Colored, dismiss, hover again, then press: all surfaces use the selected mode. Repeat in the reverse direction and after live pill updates. Check the agreed preference scope when switching agents and hosts.
- Hover and keyboard focus mount the correct installation/agent content. Leaving both trigger and preview, Escape, pressing, disconnecting and removing the plugin clean it up. Touch opens only on press.
- Spaced and unbroken long rows scroll together; neither edge clips Powerline separators. Title, account, errors and explanations stay outside the row scroller. Verify compact layout, native horizontal gestures and both themes.
- Keep lifecycle and layout tests, but record actual app screenshots/interaction evidence separately. Current passing tests do not prove these visual checks.

## Review and validation record

Independent review reported `8b66541` and `0c7904a` OK to keep, with no proven layout regression. The missing popover structure assertion is added in `test/popover-layout.test.ts`: every nonempty row has the same single horizontal scroll ancestor, and all explanatory text has no such ancestor. This complements the segment-level tests; it does not exercise Yoga, browser layout or native gestures.

Targeted checks: segment-layout (3), pills (4), popover-layout (1) passing; `npm run typecheck` and `git diff --check` passing. No runtime source changed during this follow-up, so no reload was needed. Desktop and native visual checks remain pending.
