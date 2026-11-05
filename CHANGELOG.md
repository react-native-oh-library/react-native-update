# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [10.56.1-beta.1] - 2026-10-26

Provides OpenHarmony support through `@react-native-ohos/react-native-update`, based on upstream `react-native-update` 10.56.1.

### Added

- Added an OpenHarmony native module that exposes JS interfaces through the `Pushy` TurboModule, with an `UpdatePackage` registration entry point supporting Autolink and ManualLink.
- Added `PushyFileJSBundleProvider` to load hot-update bundles from the application sandbox as part of a fallback chain with Metro and the embedded resource bundle.
- Added support for downloading and extracting full PPK packages, downloading and applying differential patches based on existing PPK packages, and differential updates based on the embedded rawfile bundle, reusing the C++ HDiffPatch/LZMA patch core.
- Added support for immediate version switching, applying updates on the next launch, app restarts, `markSuccess` success marking, rollback after a failed launch, and restoration of the embedded bundle.
- Added persistence for installation records, the UUID used for staged-rollout statistics, and update state, along with `RCTPushyDownloadProgress` download progress events.
- Added configuration synchronization for native cold-start update checks, check response caching, JS check completion marking, and SHA-256 queries for the embedded bundle.
- Added an OpenHarmony example project and installation, linking, and API documentation in Chinese and English, retaining the existing JS usage of `Pushy`, `PushyProvider`, `useUpdate`, and related APIs.
