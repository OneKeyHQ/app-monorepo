# OneKey OTA Incremental Update Specification (`metadata.json` & `diff-manifest.json`)

## 1. Overview

Starting from app version `6.8.0`, OneKey supports deterministic OTA incremental updates across **Desktop (`electron`)**, **iOS (`ios`)**, and **Android (`android`)**.

Each hot-update release produces two archives:

1. **Full Bundle (`<platform>-bundle.zip`)**: Contains the complete bundle files and the full `metadata.json`.
2. **Diff Bundle (`<platform>-diff-bundle.zip`)**: Contains:
   - `metadata.json`: The **exact same complete target `metadata.json`** shipped in the full bundle.
   - `diff-manifest.json`: The incremental diff manifest describing which files in `metadata.json` are packaged inside the diff archive (`changedFiles`) and which files must be reconstructed from local storage (`reusedFiles`).
   - All files listed in `diff-manifest.json#changedFiles`.

---

## 2. Specification 1: Full Bundle `metadata.json` (`FullMetadataSpec`)

### 2.1 File Format & Determinism Rules

- **File Name**: `metadata.json` (placed at the root of `<platform>-bundle.zip`, `<platform>-diff-bundle.zip`, and the extracted OTA directory `onekey-bundle/<appVersion>-<bundleVersion>/metadata.json`).
- **Encoding**: UTF-8 JSON object (`Record<string, string>`), formatted with 2-space indentation (`JSON.stringify(sortedMetadata, null, 2)`), with all keys sorted in ascending lexicographical code-unit order.
- **Path Normalization**:
  - Every file entry key MUST be a canonical relative POSIX path (`/` separator, no leading `/`, no `\\`, no `\0`, no `.` or `..` segments).
  - Self-referential or OS metadata filenames (`metadata.json`, `diff-manifest.json`, `dist.zip`, `.DS_Store`) MUST NOT appear as keys in `metadata.json`.

### 2.2 Platform-Specific Schema

#### A. Desktop (`appType = "electron"`)

- Produced by `FileHashMetadataPlugin` in `development/rspack/rspack.desktop.config.ts`.
- **Reserved Non-File Keys**: None (`0` reserved keys). Every key in Desktop `metadata.json` represents a file inside `build/`.
- **Hash Algorithm**: `sha512` (128-character lowercase hexadecimal string `/^[0-9a-f]{128}$/`).
- **Example**:
  ```json
  {
    "index.html": "d4f0...128_hex_chars...",
    "static/js/async/742.a1b2c3d4.js": "8c1e...128_hex_chars...",
    "static/js/main.9f8e7d6c.js": "3a7b...128_hex_chars..."
  }
  ```

#### B. Mobile (`appType = "ios" | "android"`)

- Produced by `generateMetadataJson` in `apps/mobile/build-bundle-base.js`.
- **Reserved Non-File Scalar Keys** (`RESERVED_METADATA_KEYS`):
  | Key                         | Value Example    | Description                                  |
  | :-------------------------- | :--------------- | :------------------------------------------- |
  | `requiresBackgroundBundle`  | `"true"`         | Requires `background.bundle` entry           |
  | `backgroundProtocolVersion` | `"1"`            | Background runtime protocol version          |
  | `storageSchemaVersion`      | `"mmkv-v1"`      | Storage migration compatibility marker       |
  | `bundleFormat`              | `"three-bundle"` | Union/split three-bundle architecture marker |
  | `requiresCommonBundle`      | `"true"`         | Requires `common.bundle` entry               |
- **File Entry Keys**: Every key not in `RESERVED_METADATA_KEYS` is a relative POSIX file path under `out-dir-bundle/<platform>/dist/`.
- **Hash Algorithm**: `sha256` (64-character lowercase hexadecimal string `/^[0-9a-f]{64}$/`).
- **Example**:
  ```json
  {
    "assets/node_modules/.../icon.png": "1f2e...64_hex_chars...",
    "background.bundle": "4a5b...64_hex_chars...",
    "backgroundProtocolVersion": "1",
    "bundleFormat": "three-bundle",
    "common.bundle": "7c8d...64_hex_chars...",
    "main.jsbundle.hbc": "9e0f...64_hex_chars...",
    "module-id-map.json": "a1b2...64_hex_chars...",
    "requiresBackgroundBundle": "true",
    "requiresCommonBundle": "true",
    "segments-background/seg_bg_1.seg.hbc": "c3d4...64_hex_chars...",
    "segments/seg_main_1.seg.hbc": "e5f6...64_hex_chars...",
    "storageSchemaVersion": "mmkv-v1",
    "web-embed/index.html": "0123...64_hex_chars..."
  }
  ```

### 2.3 GPG Signature Payload for `metadata.json` (`signature`)

The GPG cleartext signature (`signature`) signs a JSON `.info` payload over the raw bytes of `metadata.json` using **SHA-256** on all platforms:

```json
{
  "fileName": "metadata.json",
  "sha256": "<64-hex sha256 of metadata.json file bytes>",
  "size": 167265,
  "generatedAt": "2026-11-18T00:00:00.000Z",
  "appType": "electron | ios | android",
  "appVersion": "6.8.0",
  "buildNumber": "2026111801",
  "bundleVersion": "7701200"
}
```

---

## 3. Specification 2: Differ Bundle `diff-manifest.json` (`DiffManifestSpec`, Schema v1)

### 3.1 File Format & Schema

- **File Name**: `diff-manifest.json` (placed at the root of `<platform>-diff-bundle.zip` alongside the complete target `metadata.json`; deleted after local reconstruction completes).
- **Schema (`schemaVersion = 1`)**:
  ```json
  {
    "schemaVersion": 1,
    "appType": "electron | ios | android",
    "appVersion": "6.8.0",
    "baseAppVersion": "6.8.0",
    "baseMetadataSha256": "<64-hex sha256 of 6.8.0 base-metadata.json>",
    "targetBundleVersion": "7701200",
    "targetMetadataSha256": "<64-hex sha256 of target metadata.json>",
    "hashAlgorithm": "sha512 | sha256",
    "changedFiles": {
      "<relPath>": "<expectedFileHash>"
    },
    "reusedFiles": {
      "<relPath>": "<expectedFileHash>"
    },
    "deletedFiles": ["<relPath>"]
  }
  ```

### 3.2 Field Validation & Partition Invariants

1. **`schemaVersion`**: Must be integer `1`.
2. **`appType`**: Must match the running client platform (`"electron"`, `"ios"`, or `"android"`).
3. **`appVersion` & `targetBundleVersion`**: Must match the update target `(latestVersion, bundleVersion)`.
4. **`hashAlgorithm`**:
   - Must be `"sha512"` when `appType === "electron"` (hashes in `changedFiles` and `reusedFiles` are 128-char hex).
   - Must be `"sha256"` when `appType === "ios"` or `"android"` (hashes in `changedFiles` and `reusedFiles` are 64-char hex).
5. **`targetMetadataSha256`**: Must be a 64-char hex SHA-256 digest and MUST equal the actual SHA-256 of the `metadata.json` file extracted from the diff zip.
6. **Bijective Partition Invariant (`changedFiles ⊎ reusedFiles === fileEntries(metadata.json)`)**:
   Let $F(\texttt{metadata.json})$ be the map of all file entries in the full `metadata.json` (all keys on `electron`; all non-reserved keys on `ios`/`android`).
   - **Disjointness**: $\text{dom}(\texttt{changedFiles}) \cap \text{dom}(\texttt{reusedFiles}) = \emptyset$.
   - **Completeness (No Omission)**: Every file key $k \in \text{dom}(F(\texttt{metadata.json}))$ MUST exist in either $\texttt{changedFiles}[k]$ or $\texttt{reusedFiles}[k]$, and its hash MUST equal $F(\texttt{metadata.json})[k]$.
   - **Soundness (No Extra Keys)**: $\text{dom}(\texttt{changedFiles}) \cup \text{dom}(\texttt{reusedFiles}) = \text{dom}(F(\texttt{metadata.json}))$.
   - **Deleted Files Disjointness**: Every path in `deletedFiles` must be a safe relative POSIX path and $\texttt{deletedFiles} \cap \text{dom}(F(\texttt{metadata.json})) = \emptyset$.

### 3.3 GPG Signature Payload for `diff-manifest.json` (`diffSignature`)

The GPG cleartext signature (`diffSignature`) signs a JSON `.info` payload with `"fileName": "diff-manifest.json"`:

```json
{
  "fileName": "diff-manifest.json",
  "sha256": "<64-hex sha256 of diff-manifest.json file bytes>",
  "size": 48210,
  "generatedAt": "2026-11-18T00:00:00.000Z",
  "appType": "electron | ios | android",
  "appVersion": "6.8.0",
  "buildNumber": "2026111801",
  "bundleVersion": "7701200"
}
```

Clients MUST verify `fileName === "diff-manifest.json"` for `diffSignature` and `fileName === "metadata.json"` for `signature` to prevent cross-file signature replay.

---

## 4. Local File Lookup & Special File Location Specification

Native build scripts (`project.pbxproj`, `build.gradle`, `electron-builder-files.config.js`) and `web-embed` packaging locations are kept **100% untouched**. All path differences between `metadata.json` and the built-in 6.8.0 app package are handled by client-side multi-path lookup and diff-bundler classification.

### 4.1 Complete Catalog of Special Built-in File Locations

| #     | Platform                 | `metadata.json` Key (`<relPath>`)                                                                                                                                                   | Built-in App Package Location / Packager Behavior                                                                                                                                                                                                                                                                                                                            | Compatibility & Resolution Strategy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| :---- | :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **iOS (`ios`)**          | `main.jsbundle.hbc`                                                                                                                                                                 | Xcode copies `main.jsbundle.hbc` as **`Bundle.main.resourcePath/main.jsbundle`** (without `.hbc`).                                                                                                                                                                                                                                                                           | Native iOS `builtinCandidateRelativePaths` resolves `main.jsbundle.hbc` → `["main.jsbundle.hbc", "main.jsbundle"]` and verifies SHA-256.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **2** | **iOS (`ios`)**          | `assets/assets/<subpath>` or `assets/<subpath>`                                                                                                                                     | `build-ios-bundle.js` moves `out-dir-bundle/ios/assets` (which already contains an inner `assets/` folder from Metro `httpServerLocation`) into `dist/assets`, producing `assets/assets/<subpath>`, whereas standard RN bundling places files at single-level `Bundle.main.resourcePath/assets/<subpath>`.                                                                   | Native iOS `builtinCandidateRelativePaths` searches `assets/assets/<subpath>`, `assets/<subpath>`, and `<subpath>` under `Bundle.main.resourcePath` and verifies SHA-256.                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **3** | **iOS & Android**        | `web-embed/<subpath>`                                                                                                                                                               | Kept at its original native location without modifying `project.pbxproj` or `build.gradle`:<br>- **iOS**: Xcode folder reference `OneKeyWallet/web-embed` → `Bundle.main.resourcePath/web-embed/<subpath>` (or `Bundle.main.path(forResource: "web-embed", ofType: nil)`).<br>- **Android**: `app/src/main/assets/web-embed` → `context.assets.open("web-embed/<subpath>")`. | - Native iOS checks `Bundle.main.resourcePath/web-embed/<subpath>` and `Bundle.main.path(forResource: "web-embed", ofType: nil)/<subpath>`.<br>- Native Android checks `context.assets.open("web-embed/<subpath>")`.                                                                                                                                                                                                                                                                                                                                                                                  |
| **4** | **Android (`android`)**  | `main.jsbundle.hbc`                                                                                                                                                                 | Gradle renames `main.jsbundle.hbc` to **`index.android.bundle`** in APK `assets/`.                                                                                                                                                                                                                                                                                           | Native Android `builtinCandidateAssetPaths` resolves `main.jsbundle.hbc` → `["main.jsbundle.hbc", "index.android.bundle"]` and verifies SHA-256.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **5** | **Android (`android`)**  | `assets/drawable-*/<file>` & `assets/raw/<file>` (including `assets/raw/keep.xml`)                                                                                                  | Standard RN Android Gradle tasks package Metro assets into APK `res/drawable-*` (where `aapt2` `crunchPngs` alters PNG bytes) and `res/raw/*` (where `aapt2` strips `keep.xml`), rather than `context.assets`.                                                                                                                                                               | **Dual Protection**:<br>1. **Native Android**: `copyBuiltinAssetFile` checks `context.assets` (`assets/<subpath>`, `<subpath>`, `assets/assets/<subpath>`) and falls back to reading `res/<folder>/<file>` / `res/<folder>-v4/<file>` directly from the installed APK zips (`context.applicationInfo.sourceDir` and `context.applicationInfo.splitSourceDirs`), verifying SHA-256.<br>2. **Diff Bundler (`isBuiltinNonPreservedFile`)**: `assets/raw/keep.xml` and `assets/drawable-*/*.png` on Android are always classified into `changedFiles` so `aapt2` PNG crunching or `keep.xml` stripping never causes a fresh 6.8.0 APK to fail diff reconstruction. |
| **6** | **Desktop (`electron`)** | `static/images/icons/{512x512.icns, 512x512@2x.png, background.tiff, dmg.icns, icon.icns, installerIcon.ico, installerSidebar.bmp}`, `static/bin/**`, `static/udev/99-onekey.rules` | `electron-builder-files.config.js` excludes the 7 installer icons (`!build/static/images/icons/{...}`) and `!build/static/bin/**/*` from `app.asar/build`, placing platform binaries/rules into `process.resourcesPath` (`extraResources`).                                                                                                                                  | **Dual Protection**:<br>1. **Desktop Client (`DesktopApiBundleUpdate.ts`)**: Searches `<otaDir>/build/<relPath>`, `path.join(app.getAppPath(), 'build', <relPath>)`, and falls back to `process.resourcesPath` (`static/udev/99-onekey.rules`, `bin/bridge/<binary>`), verifying SHA-512.<br>2. **Diff Bundler (`isBuiltinNonPreservedFile`)**: The 7 asar-excluded installer icons and `static/bin/**` are always classified into `changedFiles` so a fresh 6.8.0 Desktop install always has them in the diff archive.                                                                               |

### 4.2 Final 1-to-1 Directory Verification

- Diff archives and sidecar descriptors (`*.diff.zip.meta.json`) are stored under `onekey-bundle-download/.diff/<appVersion>-<bundleVersion>.diff.zip`, and per-run reconstruction staging is isolated under `onekey-bundle/.diff-staging/<appVersion>-<bundleVersion>-<runId>`.
- Delete `<stagingDir>/diff-manifest.json`.
- Run full directory verification against `<stagingDir>/metadata.json`:
  - Every file in `metadata.json` exists on disk and its hash matches `metadata.json[relPath]`.
  - Every file on disk in `<stagingDir>` (excluding `metadata.json` and `.DS_Store`) exists in `metadata.json` (rejects any unverified extra files).
- Atomically rename `<stagingDir>` to `onekey-bundle/<appVersion>-<bundleVersion>`.
- If any file in `reusedFiles` is missing or mismatches hash, clean up `.diff-staging` and `.diff/<appVersion>-<bundleVersion>.diff.zip`, mark `fallbackRequired: true` in `.diff.zip.meta.json` (and `(appVersion, bundleVersion)` in `diffFallbackTargets`), and fall back to downloading the full `<platform>-bundle.zip`.
