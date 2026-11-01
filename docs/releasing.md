# Release checklist

The first release is prepared as **0.1.0**. No npm publication, GitHub release or marketplace submission is triggered automatically by this repository.

## Agent-scoped usage branch

The agent-usage migration requires the proposed `agents.ref(id).listUsageReports()` API and `agentUsageRevision` capability for account usage. Its manifest accepts stable Paseo versions from 0.14.0 and the 0.15.0 beta line used for local verification. This does not claim that a published version includes the API: older hosts/apps keep other widgets working and hide account usage. Before publishing the migration, link the introducing Paseo release and verify both daemon and app support it. Keep the published 0.14.0 development dependencies until the new SDK is released; the optional-method bridge must then be checked against that release.

The checks and submission details below describe the original 0.1.0 release preparation, not evidence for the account-switch migration.

## Validate the artifact

From a clean checkout of the release revision:

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm pack --dry-run --ignore-scripts
npm pack --ignore-scripts
```

Inspect `paseo-ccstatusline-0.1.0.tgz`. It must contain the manifest, README, overview, license, third-party notices, both runtime entries, every imported file under `client/`, `server/` and `shared/`, and all declared images under `assets/`. Development scripts, tests, historical docs and `node_modules/` must be absent. All runtime libraries are supplied by Paseo, so no dependency installation or build command is needed.

On a test daemon running Paseo 0.14.0 with plugins enabled, install the unpacked artifact directory and require `running` with no error in `paseo plugin ls`. Check Text/Colored switching, reopening the panel, long-row wheel scrolling, light/dark themes and a compact viewport. Verify the missing-settings error as well as a valid configuration. Do not replace a live installation just to run this check.

Preparation checks completed on 2026-10-31:

- Clean dependency install and TypeScript check passed against the published 0.14.0 SDK.
- All 160 tests passed across 15 files.
- The tarball contains 31 files, including all four manifest images, with no development scripts, tests, historical docs or dependencies.
- The unpacked tarball, with no `node_modules`, installed on a separate Paseo 0.14.0 daemon and reported `running` without an error. That daemon was stopped after the check.
- The sample-data browser capture passed on the standard host; see [screenshot provenance](screenshots.md). Native touch verification remains outstanding.

The release replaces direct client SDK type imports with the equivalent shared protocol types. Paseo's compiler accepts those erased host contracts without a plugin-local SDK installation. This avoids requiring development dependencies on users' daemons.

## Publish the source release

Merge the reviewed preparation branch and tag the tested commit `v0.1.0`. Publish a GitHub release using [CHANGELOG.md](../CHANGELOG.md) as its notes and optionally attach the checked tarball. A GitHub source is sufficient for the marketplace; npm publication is optional.

The manifest intentionally requires exactly Paseo `0.14.0`, the verified host version. Expand that range only after checking the corresponding daemon, client and SDK.

## Optional npm publication

The package name is `paseo-ccstatusline`. Confirm availability and publisher access before publishing; GitHub repository ownership does not grant ownership of an npm name. If needed, choose an npm scope you control and update the package identity and lockfile together before packing again.

```sh
npm whoami
npm view paseo-ccstatusline version
npm publish --dry-run --ignore-scripts --access public
npm publish --ignore-scripts --access public
```

An npm 404 from `npm view` can mean the package does not exist; it does not guarantee permission to publish that name. After publication, install the exact `npm:paseo-ccstatusline@0.1.0` source on the test daemon and exercise it before submitting that artifact.

## Marketplace submission draft

Use the [official submission form](https://github.com/getpaseo/plugins/issues/new?template=submit-plugin.yml) after the source release is public. The form supplies the `submission` label that starts intake.

- **Title:** ccstatusline for Paseo
- **Source:** `https://github.com/Laobei2012/paseo-ccstatusline/tree/v0.1.0`
- **Category:** Utils
- **Description:** Shows ccstatusline-style context, provider usage and configurable status rows beside each Paseo agent's composer.
- **Images:** Declared in `paseo-plugin.json` and shipped under `assets/screenshots/`. The first image is the marketplace thumbnail. Captures use sample data; the mock agent has no usage report.
- **Compatibility:** Unmodified Paseo 0.14.0. No host patches, runtime dependencies or preparation commands.

Use the tag URL only after creating that tag. For a commit-based submission, replace `v0.1.0` with the full tested commit SHA. The registry resolves and pins the reviewed artifact; direct Git installs and approved marketplace installs have separate update paths.

Before submission, verify the source URL and its manifest, overview and screenshots are publicly reachable. Do not advertise `Laobei2012/paseo-ccstatusline` as an approved marketplace install until the review is merged and the listing appears.

See Paseo's [publishing guide](https://paseo.sh/docs/plugins/publishing) and the registry's [review policy](https://github.com/getpaseo/plugins/blob/main/REVIEW.md).
