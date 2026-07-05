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
