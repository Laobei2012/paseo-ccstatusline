# paseo-ccstatusline

A Paseo plugin that shows ccstatusline information beside each agent’s composer, with shared Text and Colored views on hover and press.

See [OVERVIEW.md](OVERVIEW.md) for behavior, settings and data sources.

## Compatibility

This is a development integration. It requires Paseo host and client SDK changes that are not in the released 0.14.0 app. The manifest deliberately targets the reserved development version `0.14.0-hover-content.0` to prevent installation on an incompatible release.

The exact host changes are preserved as four ordered Git patches in [patches/paseo](patches/paseo), including their tests and SDK documentation. They apply to upstream [getpaseo/paseo](https://github.com/getpaseo/paseo) at base commit `a4f696620`; the resulting host commit is `1fd437839`.

In a clean Paseo checkout at that base, apply the patches in filename order with `git am /path/to/paseo-ccstatusline/patches/paseo/*.patch`. Build the host and SDK using that checkout’s documented workflow, and make its patched client SDK available to this plugin before typechecking. Installing the published 0.14.0 SDK alone does not provide the added API. A development host’s app version and the plugin manifest requirement must match before installation.

## Validation

- `npm run typecheck`
- `npm test`

The committed browser regression templates and recorded checks are under [docs/superpowers/spikes](docs/superpowers/spikes). They require the matching patched host.

## Source and deployment

The plugin implementation through `60daa7a` is preserved with its existing Git history. This repository also contains the host patches needed to reproduce the local integration. It does not include local deployment backups, account settings, dependencies or compiled app assets.

The remembered display mode lasts for the current plugin client lifetime and resets to Text when the app or plugin reloads. The compact sheet can repeat the long status text in its header; that issue remains unresolved.

The plugin is MIT licensed. The Paseo host patches retain their upstream Apache-2.0 licensing; its license is included at [patches/paseo/LICENSE](patches/paseo/LICENSE).
