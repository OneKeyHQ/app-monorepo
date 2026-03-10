# macOS Liquid Glass Icon

This directory contains the compiled assets for macOS 26+ Liquid Glass icons.

## Overview

Starting with macOS 26 (Tahoe), Apple introduced the "Liquid Glass" design language. To support this, apps need to use the new `.icon` format instead of the legacy `.icns` format. The OneKey Desktop app now supports both:

- **Assets.car** - Liquid Glass icon for macOS 26+
- **OneKeyLogo.icns** - Legacy icon for backward compatibility

## Source

The source icon is located at: `apps/mobile/ios/OneKeyLogo.icon/`

This icon was created using Apple's Icon Composer tool and includes:
- Glass effects and translucency
- Adaptive gradients for light/dark mode
- Specular highlights and shadows
- Display P3 color space support

## Compilation

The `Assets.car` and `OneKeyLogo.icns` files are **not committed to the repository** (ignored by .gitignore). They are generated automatically during CI builds to ensure the latest icon is always used.

### CI Integration

The icon compilation script should be run in CI workflows for macOS builds:

```bash
cd apps/desktop
bash scripts/compile-liquid-icon.sh
```

Add this command before the build step in your GitHub Actions or CI pipeline for macOS builds.

### Manual Compilation

To manually recompile the icon (only needed when updating the icon design):

```bash
cd apps/desktop
bash scripts/compile-liquid-icon.sh
```

This script:
1. Checks for `actool` availability (requires Xcode on macOS)
2. Compiles `OneKeyLogo.icon` to `Assets.car`
3. Generates a backward-compatible `OneKeyLogo.icns`

### Requirements

- macOS with Xcode installed
- `actool` (included with Xcode)
- macOS 26+ SDK for full Liquid Glass support

## Integration

The compiled assets are integrated into the Electron app through:

1. **electron-builder.config.js** - Main distribution
2. **electron-builder-mas.config.js** - Mac App Store distribution

Configuration:
```javascript
'extraResources': [
  {
    'from': 'resources/icons/Assets.car',
    'to': 'Assets.car',
  },
],
'extendInfo': {
  'CFBundleIconName': 'OneKeyLogo',
}
```

## Workflow

1. **Local Development**:
   - Run `bash scripts/compile-liquid-icon.sh` to generate Assets.car locally
   - The generated files are ignored by .gitignore (not committed)
   - Build and test your changes locally

2. **Icon Updates**: When updating the icon design in `apps/mobile/ios/OneKeyLogo.icon/`:
   - Modify the icon source files
   - Commit only the source changes (`.icon` directory)
   - CI will automatically regenerate Assets.car during builds

3. **CI Builds**:
   - CI automatically runs the compilation script before building
   - Fresh Assets.car is generated from the latest icon source
   - Ensures consistency between icon source and compiled assets

## References

- [Electron Builder Feature Request](https://github.com/electron-userland/electron-builder/issues/9254)
- [Supporting Liquid Glass Icons](https://www.hendrik-erz.de/post/supporting-liquid-glass-icons-in-apps-without-xcode)
- [Electron Icon Discussion](https://github.com/electron/electron/issues/48476)
