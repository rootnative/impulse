# Releasing `@rootnative/impulse`

This is the release runbook. It gives the steps. The comments in the two release workflows give the reason for each step.

The workflows publish what is already committed. They do not bump the version, write the CHANGELOG, or change the README status lines. A human makes that commit, and a reviewer reads it.

## The state on npm

- `0.0.0-alpha.0` is the only published version. It is on the `latest` and `alpha` dist-tags.
- It was published from a laptop on 2026-09-12, with no provenance. npm cannot register a trusted publisher for a package that does not exist, so the first publish could not use CI.
- The package now exists. Every later release goes through CI with OIDC.

## One-time setup: register both workflows

Do this before the first CI release. npm binds a trusted publisher to an exact repository and an exact workflow filename. An unregistered workflow fails at the publish step with `404 PUT /@rootnative%2fimpulse`, after every gate has passed.

1. On npmjs.com, open `@rootnative/impulse` → **Settings** → **Trusted publishing**.
2. Add a GitHub Actions publisher: owner `rootnative`, repository `impulse`, workflow `release.yml`. Restrict it to **staged publishing only**.
3. Add a second publisher with the workflow `release-manual.yml`, with the same stage-only restriction. The first one does not cover this file.
4. Do not add an `NPM_TOKEN` or `NODE_AUTH_TOKEN` secret to the repository. A standing token takes precedence over OIDC and hides a registration fault.

Do the steps again if you rename a workflow file. A rename revokes nothing and warns about nothing.

## Choose the dist-tag

`scripts/check-release.mjs` enforces this table.

| Version | `latest` on npm now | Dist-tag |
| --- | --- | --- |
| A prerelease, such as `0.0.0-alpha.1` | A prerelease | `latest` is allowed, with a warning |
| A prerelease | A stable version | `alpha`, `beta`, or `rc`. `latest` fails. |
| A stable version, such as `0.0.1` | Any | `latest`. Any other tag warns, because `npm install` does not resolve it. |

After the first stable release, send every prerelease to `alpha`, `beta`, or `rc`.

## 1. Prepare the release commit

Work on a branch from `main`.

1. Set `version` in `packages/core/package.json`. Use bare three-digit semver: `0.0.1`, never `v0.0.1`.
2. In `packages/core/CHANGELOG.md`, move the `## [Unreleased]` entries under a new `## [<version>] - <YYYY-MM-DD>` heading. Leave `## [Unreleased]` in place and empty.
3. Run `pnpm run check:versions:fix`. It rewrites the CHANGELOG link footer and the `> **Status:**` lines in `README.md` and `packages/core/README.md`. It does not write a release note.
4. For a stable version, update the version on `docs/docs/roadmap.md`. `check:versions` does not read that file.
5. Run `pnpm run build:llms`.
6. Run `pnpm run preflight`. It runs format, lint, typecheck, test, build, `check:versions`, `check:llms`, and `check:artifact`, in that order. CI runs the same script.
7. Run `node scripts/check-release.mjs --version <version> --dist-tag <tag>`. It checks the npm version, the committed version, the tag, and the dist-tag.
8. Open a pull request and merge it to `main`.

A stable release also needs the device gate of its milestone. Read the milestones on `docs/docs/roadmap.md` before you cut `0.0.1`. The mechanical half passes. The feel half has no result.

## 2. Stage

The workflows do not publish directly. Both trusted publishers are restricted to staged publishing, so CI can only upload a version and hold it. A maintainer approves it with 2FA in step 3. Until then, nothing is installable.

1. Open **Actions** → **Release** → **Run workflow**, from `main`.
2. Enter the version and the dist-tag. Set `dry_run` to `true`.
3. Make sure that the dry run passes. It runs every gate and packs the tarball, and it stages nothing.
4. Run the workflow again with `dry_run` set to `false`.

The workflow does these steps in this order:

1. It runs `check-release.mjs`.
2. It runs `pnpm run preflight`.
3. It pushes the tag `core@<version>`.
4. It runs `npm stage publish` with `--provenance` and the dist-tag.
5. It creates the GitHub Release. A version with a `-` becomes a prerelease.

The tag goes before the stage on purpose. A tag push can fail and leave nothing staged. The dist-tag is fixed when the version is staged. It cannot change at approval.

## 3. Approve

1. Inspect the staged version. On npmjs.com, open the package → **Staged Packages**. Or, from a laptop:

   ```bash
   npm stage list @rootnative/impulse
   npm stage view <stage-id>
   ```

2. Approve it with 2FA, on the website or with `npm stage approve <stage-id>`. This is the step that cannot be undone.
3. If the tarball is wrong, reject it with `npm stage reject <stage-id>`, then delete the GitHub Release and the tag, and release the next version number. Do not assume that a rejected version number is free on npm.

## 4. Verify

1. Run `npm view @rootnative/impulse dist-tags`. The dist-tag must name the new version. Before approval, it still names the previous one.
2. Open the version on npmjs.com. It must show a provenance badge. No badge means that the version did not come from CI.
3. Make sure that the tag `core@<version>` and the GitHub Release exist.
4. The docs site deploys through `deploy-web.yml` when the release commit reaches `main`. Make sure that the site shows the new status.

## When a run fails

| Failed step | What was released | What to do |
| --- | --- | --- |
| Check the release | Nothing | Read the message. It names the fix. |
| Preflight | Nothing | Fix the fault on `main`, then run the workflow again. |
| Tag the release | Nothing | Fix the push permission or the tag protection, then run the workflow again. |
| Stage the publish on npm | Nothing on npm. The tag exists. | Read the next step's output. A 404 is authentication, not a missing package. A rejected `npm publish` means the workflow ran the direct command against a stage-only publisher. Fix the cause, delete the tag with `git push --delete origin core@<version> && git tag -d core@<version>`, then run the workflow again. |
| Create the GitHub Release | The version is staged. The tag exists. | Do not run the workflow again. `check-release.mjs` stops on the tag. Create the release by hand: `gh release create core@<version> --title <version> --generate-notes`. Add `--prerelease` for a prerelease. Then approve the staged version. |

npm never accepts the same version two times, even after an unpublish. If a bad version reaches npm, fix the fault and release the next version.

## The manual workflow

`release-manual.yml` publishes a named ref: a branch, a tag, or a full commit SHA. Use it only when `release.yml` cannot express the release, for example to publish an exact commit. It runs the same gates, and no input skips them.

1. Enter the ref, the version, and the dist-tag.
2. Read the "Publishing from" summary. It shows the commit, and it tells you if the commit is not on `main`.
3. Do a dry run first, as for `release.yml`. It stages, like `release.yml`, and needs the same approval.

**`create_release: false` does not work for the case that its description names.** The input exists to publish again when the tag and the GitHub Release already exist. But `check-release.mjs` stops every run where `core@<version>` already exists, so that run always fails at the first gate. Delete the tag and use the default, as the table above says.

## A new package name

This section applies only if the repository publishes a second package. npm cannot register a trusted publisher before the package exists.

1. Publish the first version from a laptop, logged in as a person with two-factor authentication.
2. Register both workflows as trusted publishers, as in the one-time setup.
3. Publish every later version through CI.

Do not add a token "for the first release only". It stays in the repository and takes precedence over OIDC after that.
