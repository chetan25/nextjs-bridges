## @nextjs-bridges/hydration-v1.0.0 (2026-07-08)

### ⚠ BREAKING CHANGES

* every published package moves scope --
@chetand/lazy-handler, @chetand/hydration, and @chetand/share are replaced
by @nextjs-bridges/lazy-handler, @nextjs-bridges/hydration, and
@nextjs-bridges/share. The old @chetand/* versions remain on npm but are
no longer maintained; there is no automated migration, since npm doesn't
support renaming a package in place.

Updates every package.json, tsconfig extends path, release.config.js tag/
commit-message template, the release workflow, all app imports and
next.config.ts wiring, and READMEs. Each package's version resets to 1.0.0
for a clean first release under the new scope -- semantic-release will
compute the real version from git tags going forward, and no tags exist
yet under the new name. CHANGELOG.md files are left untouched: their
compare links point at real @chetand/* git tags, so rewriting them would
misrepresent history.

Requires an NPM_TOKEN with publish access to the new @nextjs-bridges org
before the next push to main, or the release job will fail at the npm-auth
step (by existing design -- see the root README's release docs).
* **share:** assertSharedDepsAvailable's runtime version check no longer
treats a bare (non-caret) entry.version as an exact-match requirement; it now
always applies caret-range semantics, so a live shared dependency with a
higher patch than declared is accepted instead of throwing.
* consumers importing from @bridge/lazy-handler,
@bridge/hydration, or @bridge/share must update to @chetand/lazy-handler,
@chetand/hydration, and @chetand/share respectively.

### Features

* **001:** added the bridges for nextjs ([b10fb22](https://github.com/chetan25/nextjs-bridges/commit/b10fb22e55cae737d075cd514ea6e487a8c59787))
* **hydration:** support strategy arrays, narrow interaction events, add errorFallback ([dd06a32](https://github.com/chetan25/nextjs-bridges/commit/dd06a328c2acafdcbf93d22f3671d0db7a5ac5ba))
* **share:** add hot-reload, patch-depth checks, generic peer-libs; hydration gets code-splitting ([5df8e3b](https://github.com/chetan25/nextjs-bridges/commit/5df8e3b83dbbcf03f960bff96b6dcb215becbea3))

### Code Refactoring

* rename npm scope from [@bridge](https://github.com/bridge) to [@chetand](https://github.com/chetand) ([0c2b11d](https://github.com/chetan25/nextjs-bridges/commit/0c2b11dbf22115a9e739504ef87ef1a887c22614))
* rename npm scope from [@chetand](https://github.com/chetand) to [@nextjs-bridges](https://github.com/nextjs-bridges) ([0d1d276](https://github.com/chetan25/nextjs-bridges/commit/0d1d276b0b739fe6d113444476ace4313abd0341))

## [@chetand/hydration-v2.1.0](https://github.com/chetan25/nextjs-bridges/compare/@chetand/hydration-v2.0.0...@chetand/hydration-v2.1.0) (2026-07-08)

### Features

* **hydration:** support strategy arrays, narrow interaction events, add errorFallback ([dd06a32](https://github.com/chetan25/nextjs-bridges/commit/dd06a328c2acafdcbf93d22f3671d0db7a5ac5ba))

## [@chetand/hydration-v2.0.0](https://github.com/chetan25/nextjs-bridges/compare/@chetand/hydration-v1.0.0...@chetand/hydration-v2.0.0) (2026-07-06)

### ⚠ BREAKING CHANGES

* **share:** assertSharedDepsAvailable's runtime version check no longer
treats a bare (non-caret) entry.version as an exact-match requirement; it now
always applies caret-range semantics, so a live shared dependency with a
higher patch than declared is accepted instead of throwing.

### Features

* **share:** add hot-reload, patch-depth checks, generic peer-libs; hydration gets code-splitting ([5df8e3b](https://github.com/chetan25/nextjs-bridges/commit/5df8e3b83dbbcf03f960bff96b6dcb215becbea3))

## @chetand/hydration-v1.0.0 (2026-07-05)

### ⚠ BREAKING CHANGES

* consumers importing from @bridge/lazy-handler,
@bridge/hydration, or @bridge/share must update to @chetand/lazy-handler,
@chetand/hydration, and @chetand/share respectively.

### Features

* **001:** added the bridges for nextjs ([b10fb22](https://github.com/chetan25/nextjs-bridges/commit/b10fb22e55cae737d075cd514ea6e487a8c59787))

### Code Refactoring

* rename npm scope from [@bridge](https://github.com/bridge) to [@chetand](https://github.com/chetand) ([0c2b11d](https://github.com/chetan25/nextjs-bridges/commit/0c2b11dbf22115a9e739504ef87ef1a887c22614))
