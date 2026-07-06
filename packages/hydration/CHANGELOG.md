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
