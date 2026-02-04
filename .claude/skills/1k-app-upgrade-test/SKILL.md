---
name: 1k-app-upgrade-test
description: Create test versions to verify app auto-update functionality. Use when testing update flows, version migration, or validating app upgrade mechanisms. Automates version number and build number configuration for testing the auto-update system. Triggers on auto update, app upgrade, update testing, upgrade flow, version migration, test build, 9XXX version.
allowed-tools: Read, Grep, Glob, Write, Edit, Bash
disable-model-invocation: true
---

# Test Version Creation

Automates creation of test version branches with hardcoded build configurations for testing app upgrade functionality and version migration flows.

## Quick Reference

### Version Pattern

Test versions follow the pattern: **`9XXX.YY.Z`**

- `9XXX` - Test version indicator (e.g., 9005)
- `YY.Z` - Matches production version being tested

Example: `9005.20.0` for testing production `5.20.0`

### Build Number Formula

Build number is calculated as:

```bash
DATE=$(date +%Y%m%d)
BUILD_NUMBER=$((${DATE}00 + 30))
```

**Format**: 10 digits = `YYYYMMDD00 + 30`

Example: If today is `20260130`, build number is `2026013030`

## Workflow

### Step 1: Get Version Information

Ask user for test version number:
- Format: `9XXX.YY.Z`
- Example: `9005.20.0`

### Step 2: Calculate Build Number

```bash
DATE=$(date +%Y%m%d)
BUILD_NUMBER=$((${DATE}00 + 30))
echo "Build number: $BUILD_NUMBER"
```

### Step 3: Create Branch

```bash
git checkout -b <test_version>
# Example: git checkout -b 9005.20.0
```

### Step 4: Modify Configuration Files

Update these files in order:

1. **`.env.version`**
   - Set VERSION to test version
   - Set BUILD_NUMBER to calculated value

2. **`.github/actions/shared-env/action.yml`**
   - Update version in outputs section

3. **`.github/workflows/release-android.yml`**
   - Update versionName in android-build job

4. **`apps/mobile/android/app/build.gradle`**
   - Update versionCode
   - Update versionName

### Step 5: Commit and Push

```bash
git add .
git commit -m "chore: create test version <version>"
git push origin <test_version>
```

## Files to Modify

| File | What to Update |
|------|----------------|
| `.env.version` | VERSION, BUILD_NUMBER |
| `.github/actions/shared-env/action.yml` | outputs.version |
| `.github/workflows/release-android.yml` | versionName |
| `apps/mobile/android/app/build.gradle` | versionCode, versionName |

## Detailed Guide

For comprehensive test version creation workflow with examples, see [upgrade-test-version.md](references/rules/upgrade-test-version.md).

Topics covered:
- Version number format and conventions
- Build number calculation formula
- Step-by-step file modification instructions
- Configuration file examples
- Git workflow for test versions
- QA testing considerations

## When to Use This Skill

- Creating test builds for QA upgrade testing
- Testing version migration flows
- Verifying app upgrade functionality
- Creating release candidates with specific build numbers
- Testing version-specific features or fixes

## Related Skills

- `/1k-git-workflow` - Git branching conventions
- `/1k-dev-commands` - Build and release commands
