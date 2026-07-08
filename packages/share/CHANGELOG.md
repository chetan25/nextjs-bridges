## @nextjs-bridges/share-v1.0.0 (2026-07-08)

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
* **share:** add BridgeSharedDepsProvider client component ([92fa16f](https://github.com/chetan25/nextjs-bridges/commit/92fa16f43a166471fbb9e9d7bddc35822c50c134))
* **share:** add createRemoteRegistry to bind a manifest URL once ([e24bf02](https://github.com/chetan25/nextjs-bridges/commit/e24bf02889b9ea2a8b765c5772daf46afa8c993a))
* **share:** add external flag to ShareManifest.shared entries ([9575c6b](https://github.com/chetan25/nextjs-bridges/commit/9575c6bfec58feb7591abc54fc5d7d3eeea87f44))
* **share:** add hot-reload, patch-depth checks, generic peer-libs; hydration gets code-splitting ([5df8e3b](https://github.com/chetan25/nextjs-bridges/commit/5df8e3b83dbbcf03f960bff96b6dcb215becbea3))
* **share:** add react/react-dom shim modules for externalized chunks ([2bebf37](https://github.com/chetan25/nextjs-bridges/commit/2bebf37b91afd172fb07554072f550b7cb0b9929))
* **share:** add resolveSharedDeps compatibility check ([6cf033b](https://github.com/chetan25/nextjs-bridges/commit/6cf033b1c6040b9daa249cea45bbaae8a72e9c1c))
* **share:** add sharedDepsConfig for the consuming shell ([62de1f6](https://github.com/chetan25/nextjs-bridges/commit/62de1f6e5a2148695c28fe36edfb47fd71a52ff3))
* **share:** fix manifest->chunk waterfall with preloading and resource hints ([9964edd](https://github.com/chetan25/nextjs-bridges/commit/9964edd2d0bc1515d6e8faaa5f84d6c28a1849bf))
* **share:** guard externalized chunks against shared-dep drift at mount time ([c77f6b3](https://github.com/chetan25/nextjs-bridges/commit/c77f6b387e8c3f6c25de36d5788f12403d97db71))
* **share:** publish shared-dep-resolver as a package export ([af12747](https://github.com/chetan25/nextjs-bridges/commit/af12747caa281f31b885a17964527d5c5a7f3e0c))
* **share:** read shared-dep contract from disk ([3a35386](https://github.com/chetan25/nextjs-bridges/commit/3a35386e8d481156f31b58cf6a068a86a593bcd5))
* wire shell and exposing app configs for shared-dep externalization ([5a6f312](https://github.com/chetan25/nextjs-bridges/commit/5a6f312e6ca8fdd2ecfd774f44cc2d5a973f1eb0))

### Bug Fixes

* **share:** add missing startTransition export to react-shim ([7debef5](https://github.com/chetan25/nextjs-bridges/commit/7debef5757252d6dd58a2e558f54e8cb593ae0bb))
* **share:** compute real shared-dep versions instead of hardcoded 0.0.0 ([462cbcd](https://github.com/chetan25/nextjs-bridges/commit/462cbcd9573e83a1d8190f5c9f3e091269a0ae33))
* **share:** guard BridgeSharedDepsProvider's window access against SSR ([a91672a](https://github.com/chetan25/nextjs-bridges/commit/a91672ae9df4389c10e026318d63af925d07ad73))
* **share:** pass entry.version through directly instead of double-wrapping with a caret ([d435ec8](https://github.com/chetan25/nextjs-bridges/commit/d435ec8bb8ccdaca6fae33f9cda5430ae21fa3e0))
* **share:** publish build-time-declared version, not live React.version ([09448d6](https://github.com/chetan25/nextjs-bridges/commit/09448d6f63e269c87d709f6028e5b3f99ae03026))

### Code Refactoring

* rename npm scope from [@bridge](https://github.com/bridge) to [@chetand](https://github.com/chetand) ([0c2b11d](https://github.com/chetan25/nextjs-bridges/commit/0c2b11dbf22115a9e739504ef87ef1a887c22614))
* rename npm scope from [@chetand](https://github.com/chetand) to [@nextjs-bridges](https://github.com/nextjs-bridges) ([0d1d276](https://github.com/chetan25/nextjs-bridges/commit/0d1d276b0b739fe6d113444476ace4313abd0341))

## [@chetand/share-v2.1.0](https://github.com/chetan25/nextjs-bridges/compare/@chetand/share-v2.0.0...@chetand/share-v2.1.0) (2026-07-08)

### Features

* **share:** add createRemoteRegistry to bind a manifest URL once ([e24bf02](https://github.com/chetan25/nextjs-bridges/commit/e24bf02889b9ea2a8b765c5772daf46afa8c993a))
* **share:** fix manifest->chunk waterfall with preloading and resource hints ([9964edd](https://github.com/chetan25/nextjs-bridges/commit/9964edd2d0bc1515d6e8faaa5f84d6c28a1849bf))

## [@chetand/share-v2.0.0](https://github.com/chetan25/nextjs-bridges/compare/@chetand/share-v1.0.0...@chetand/share-v2.0.0) (2026-07-06)

### ⚠ BREAKING CHANGES

* **share:** assertSharedDepsAvailable's runtime version check no longer
treats a bare (non-caret) entry.version as an exact-match requirement; it now
always applies caret-range semantics, so a live shared dependency with a
higher patch than declared is accepted instead of throwing.

### Features

* **share:** add hot-reload, patch-depth checks, generic peer-libs; hydration gets code-splitting ([5df8e3b](https://github.com/chetan25/nextjs-bridges/commit/5df8e3b83dbbcf03f960bff96b6dcb215becbea3))

## @chetand/share-v1.0.0 (2026-07-05)

### ⚠ BREAKING CHANGES

* consumers importing from @bridge/lazy-handler,
@bridge/hydration, or @bridge/share must update to @chetand/lazy-handler,
@chetand/hydration, and @chetand/share respectively.

### Features

* **001:** added the bridges for nextjs ([b10fb22](https://github.com/chetan25/nextjs-bridges/commit/b10fb22e55cae737d075cd514ea6e487a8c59787))
* **share:** add BridgeSharedDepsProvider client component ([92fa16f](https://github.com/chetan25/nextjs-bridges/commit/92fa16f43a166471fbb9e9d7bddc35822c50c134))
* **share:** add external flag to ShareManifest.shared entries ([9575c6b](https://github.com/chetan25/nextjs-bridges/commit/9575c6bfec58feb7591abc54fc5d7d3eeea87f44))
* **share:** add react/react-dom shim modules for externalized chunks ([2bebf37](https://github.com/chetan25/nextjs-bridges/commit/2bebf37b91afd172fb07554072f550b7cb0b9929))
* **share:** add resolveSharedDeps compatibility check ([6cf033b](https://github.com/chetan25/nextjs-bridges/commit/6cf033b1c6040b9daa249cea45bbaae8a72e9c1c))
* **share:** add sharedDepsConfig for the consuming shell ([62de1f6](https://github.com/chetan25/nextjs-bridges/commit/62de1f6e5a2148695c28fe36edfb47fd71a52ff3))
* **share:** guard externalized chunks against shared-dep drift at mount time ([c77f6b3](https://github.com/chetan25/nextjs-bridges/commit/c77f6b387e8c3f6c25de36d5788f12403d97db71))
* **share:** publish shared-dep-resolver as a package export ([af12747](https://github.com/chetan25/nextjs-bridges/commit/af12747caa281f31b885a17964527d5c5a7f3e0c))
* **share:** read shared-dep contract from disk ([3a35386](https://github.com/chetan25/nextjs-bridges/commit/3a35386e8d481156f31b58cf6a068a86a593bcd5))
* wire shell and exposing app configs for shared-dep externalization ([5a6f312](https://github.com/chetan25/nextjs-bridges/commit/5a6f312e6ca8fdd2ecfd774f44cc2d5a973f1eb0))

### Bug Fixes

* **share:** add missing startTransition export to react-shim ([7debef5](https://github.com/chetan25/nextjs-bridges/commit/7debef5757252d6dd58a2e558f54e8cb593ae0bb))
* **share:** compute real shared-dep versions instead of hardcoded 0.0.0 ([462cbcd](https://github.com/chetan25/nextjs-bridges/commit/462cbcd9573e83a1d8190f5c9f3e091269a0ae33))
* **share:** guard BridgeSharedDepsProvider's window access against SSR ([a91672a](https://github.com/chetan25/nextjs-bridges/commit/a91672ae9df4389c10e026318d63af925d07ad73))
* **share:** pass entry.version through directly instead of double-wrapping with a caret ([d435ec8](https://github.com/chetan25/nextjs-bridges/commit/d435ec8bb8ccdaca6fae33f9cda5430ae21fa3e0))
* **share:** publish build-time-declared version, not live React.version ([09448d6](https://github.com/chetan25/nextjs-bridges/commit/09448d6f63e269c87d709f6028e5b3f99ae03026))

### Code Refactoring

* rename npm scope from [@bridge](https://github.com/bridge) to [@chetand](https://github.com/chetand) ([0c2b11d](https://github.com/chetan25/nextjs-bridges/commit/0c2b11dbf22115a9e739504ef87ef1a887c22614))
