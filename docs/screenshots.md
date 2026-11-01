# Screenshot provenance

The images in `assets/screenshots/` were captured on 2026-10-31 using the current plugin client inside Paseo's real browser application, against an isolated daemon. They show the click-open panel on the unmodified host at upstream commit `a4f696620b5d248598a882b1a78d82ec5038c74b` (Paseo 0.14.0).

The capture used the plugin's `index.client.tsx`, `client/` and `shared/` modules. A temporary fixture server returned a sample branch (`feature/status-panel`) and memory values (8 GiB used / 32 GiB total) through the real plugin RPC transport. Its layout contained model/branch, memory and thinking-effort rows with the `nord-aurora` Powerline theme. The mock provider supplied its actual model label, `Ten second stream`, and no context or provider usage report. Unavailable values remain `--`; the images do not demonstrate real account attribution or usage accuracy.

| File | Capture |
| --- | --- |
| `colored-dark.png` | Colored panel and composer, dark theme |
| `colored-light.png` | Colored panel and composer, light theme |
| `text-dark.png` | Text panel and composer, dark theme |
| `compact-dark.png` | Colored panel in a 390 × 844 web viewport |

Desktop captures use a 750 × 380 crop of an 1100 × 700 browser viewport. The crop was selected at screenshot time and keeps the status panel, pill and composer together. No rendered values were edited. The screenshots contain no real user account, repository content or credentials.

The browser check verified panel opening, row content, switching Text/Colored, remembering the selected mode after closing and reopening, both themes, and the compact sheet. It passed in 19.2 seconds including setup and teardown. It did not verify native touch gestures. Earlier captures under `docs/superpowers/spikes/assets/hover/` depict a reverted interactive-hover experiment and are not release media.

To refresh these images, use Paseo's isolated browser E2E fixtures from the host checkout, install a temporary copy of the plugin client with the sample RPC server described above, and click the composer pill. Use the same viewports and capture names, confirm both themes have settled, and inspect every image before committing it. Keep fixture settings and daemon homes temporary; do not capture live account labels or alter a user's settings for documentation.
