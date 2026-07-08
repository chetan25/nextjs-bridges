## @nextjs-bridges/lazy-handler-v1.0.0 (2026-07-08)

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
* consumers importing from @bridge/lazy-handler,
@bridge/hydration, or @bridge/share must update to @chetand/lazy-handler,
@chetand/hydration, and @chetand/share respectively.

### Features

* **001:** added the bridges for nextjs ([b10fb22](https://github.com/chetan25/nextjs-bridges/commit/b10fb22e55cae737d075cd514ea6e487a8c59787))
* **lazy-handler,storefront:** add use-lazy-handler subpath export; wire ProductCard and lazy Add to Cart into HomeWidget ([8cff269](https://github.com/chetan25/nextjs-bridges/commit/8cff269e0bc24503254104b6950a2e7284d9ee38))
* **lazy-handler:** add idle preload strategy and multi-strategy preloadOn ([d1db2b7](https://github.com/chetan25/nextjs-bridges/commit/d1db2b78382fd92eb41a40286b79b5200ffea0fb))
* **lazy-handler:** add loading-state API to useLazyHandler, Interactive, and withLazyHandlers ([0dbb72e](https://github.com/chetan25/nextjs-bridges/commit/0dbb72e015d36dbfa9ad5c4609357228ce5500f9))
* **lazy-handler:** add respectConnection to skip preloadOn on slow connections ([afb0b8d](https://github.com/chetan25/nextjs-bridges/commit/afb0b8dd311605b42088b9adadd595c411f94c2b))
* **lazy-handler:** add useLazyForm, preventDefault option, error/onError surfacing ([29a8019](https://github.com/chetan25/nextjs-bridges/commit/29a8019c0aec49590450eaf7ac38c715d4a5300d))

### Bug Fixes

* **001:** fixed hoc comp logic ([bb8d52d](https://github.com/chetan25/nextjs-bridges/commit/bb8d52de03b485a6a0a09b66b70342f91f788885))
* **lazy-handler:** attach listener when ref target mounts after initial render ([2848ace](https://github.com/chetan25/nextjs-bridges/commit/2848aced936fc0412f01c2140e0b3b60a6c4380f))

### Code Refactoring

* rename npm scope from [@bridge](https://github.com/bridge) to [@chetand](https://github.com/chetand) ([0c2b11d](https://github.com/chetan25/nextjs-bridges/commit/0c2b11dbf22115a9e739504ef87ef1a887c22614))
* rename npm scope from [@chetand](https://github.com/chetand) to [@nextjs-bridges](https://github.com/nextjs-bridges) ([0d1d276](https://github.com/chetan25/nextjs-bridges/commit/0d1d276b0b739fe6d113444476ace4313abd0341))

## [@chetand/lazy-handler-v1.2.0](https://github.com/chetan25/nextjs-bridges/compare/@chetand/lazy-handler-v1.1.0...@chetand/lazy-handler-v1.2.0) (2026-07-08)

### Features

* **lazy-handler:** add respectConnection to skip preloadOn on slow connections ([afb0b8d](https://github.com/chetan25/nextjs-bridges/commit/afb0b8dd311605b42088b9adadd595c411f94c2b))
* **lazy-handler:** add useLazyForm, preventDefault option, error/onError surfacing ([29a8019](https://github.com/chetan25/nextjs-bridges/commit/29a8019c0aec49590450eaf7ac38c715d4a5300d))

## [@chetand/lazy-handler-v1.1.0](https://github.com/chetan25/nextjs-bridges/compare/@chetand/lazy-handler-v1.0.0...@chetand/lazy-handler-v1.1.0) (2026-07-06)

### Features

* **lazy-handler:** add loading-state API to useLazyHandler, Interactive, and withLazyHandlers ([0dbb72e](https://github.com/chetan25/nextjs-bridges/commit/0dbb72e015d36dbfa9ad5c4609357228ce5500f9))

## @chetand/lazy-handler-v1.0.0 (2026-07-05)

### ⚠ BREAKING CHANGES

* consumers importing from @bridge/lazy-handler,
@bridge/hydration, or @bridge/share must update to @chetand/lazy-handler,
@chetand/hydration, and @chetand/share respectively.

### Features

* **001:** added the bridges for nextjs ([b10fb22](https://github.com/chetan25/nextjs-bridges/commit/b10fb22e55cae737d075cd514ea6e487a8c59787))
* **lazy-handler,storefront:** add use-lazy-handler subpath export; wire ProductCard and lazy Add to Cart into HomeWidget ([8cff269](https://github.com/chetan25/nextjs-bridges/commit/8cff269e0bc24503254104b6950a2e7284d9ee38))
* **lazy-handler:** add idle preload strategy and multi-strategy preloadOn ([d1db2b7](https://github.com/chetan25/nextjs-bridges/commit/d1db2b78382fd92eb41a40286b79b5200ffea0fb))

### Bug Fixes

* **001:** fixed hoc comp logic ([bb8d52d](https://github.com/chetan25/nextjs-bridges/commit/bb8d52de03b485a6a0a09b66b70342f91f788885))
* **lazy-handler:** attach listener when ref target mounts after initial render ([2848ace](https://github.com/chetan25/nextjs-bridges/commit/2848aced936fc0412f01c2140e0b3b60a6c4380f))

### Code Refactoring

* rename npm scope from [@bridge](https://github.com/bridge) to [@chetand](https://github.com/chetand) ([0c2b11d](https://github.com/chetan25/nextjs-bridges/commit/0c2b11dbf22115a9e739504ef87ef1a887c22614))
