# CI Integration Guide for Liquid Glass Icon

## Overview

This guide explains how to integrate the Liquid Glass icon compilation into CI workflows for macOS builds.

## GitHub Actions Example

Add the icon compilation step before building the macOS desktop app:

```yaml
name: Build Desktop macOS

jobs:
  build-macos:
    runs-on: macos-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: yarn install

      # Compile Liquid Glass Icon
      - name: Compile macOS Liquid Glass Icon
        run: |
          cd apps/desktop
          bash scripts/compile-liquid-icon.sh

      # Build the app
      - name: Build Desktop App
        run: |
          cd apps/desktop
          yarn build:mac
```

## When to Run

The icon compilation script should be run:

1. **On macOS Runners Only**: The script requires `actool` which is only available on macOS
2. **Before Build**: Run the script before the `yarn build:mac` or `yarn build:mas` commands
3. **When Icon Changes**: If the source icon at `apps/mobile/ios/OneKeyLogo.icon/` is updated

## Script Behavior

The `compile-liquid-icon.sh` script is designed to be CI-friendly:

- ✅ Gracefully exits if `actool` is not available (non-macOS runners)
- ✅ Skips compilation if source icon is not found
- ✅ Outputs clear status messages for CI logs
- ✅ Exits with status 0 on warnings (won't break CI)

## Verification

After CI runs, verify that:

1. The Assets.car file is generated (1.7MB)
2. The OneKeyLogo.icns file is generated (57KB)
3. The build succeeds and the app icon displays correctly

### Automated Verification

Use the verification script to check icon compatibility:

```bash
cd apps/desktop
bash scripts/verify-icon-compatibility.sh ./build-electron/mac-universal/OneKey.app
```

This script checks:
- ✓ Info.plist contains both CFBundleIconName and CFBundleIconFile
- ✓ Assets.car exists and contains OneKeyLogo
- ✓ icon.icns exists for legacy compatibility
- ✓ Full compatibility for macOS 26+ and earlier versions

## Local Testing

To test the CI workflow locally on macOS:

```bash
cd apps/desktop
bash scripts/compile-liquid-icon.sh
yarn build:mac
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `actool not found` | Ensure Xcode is installed on the macOS runner |
| `Icon export exited with status 255` | This is a warning, not an error. The icon still compiles successfully |
| `Icon source not found` | Check that the repository includes `apps/mobile/ios/OneKeyLogo.icon/` |
| Build fails with icon error | Verify `CFBundleIconName` is set to `'OneKeyLogo'` in electron-builder configs |
