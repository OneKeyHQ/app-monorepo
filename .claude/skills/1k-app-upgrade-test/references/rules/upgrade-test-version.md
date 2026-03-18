# Creating Upgrade Test Version

Automates the creation of test version branches with hardcoded build configurations for testing app upgrade functionality and version migration flows.

## Workflow

### Step 1: Gather Version Information

Ask the user for the test version number using AskUserQuestion:

```
Question: "What test version number should be used?"
Options:
- "9005.20.0" (example format)
- Custom input
```

The version should follow the pattern `9XXX.YY.Z` where:
- `9XXX` indicates a test version (e.g., 9005)
- `YY.Z` matches the production version being tested

### Step 2: Calculate Build Number

Calculate the build number as: **current date (YYYYMMDD) + "00" suffix + 30**

The build number must be 10 digits in format: `YYYYMMDD00 + 30 = YYYYMMDD30`

Example: If today is `20260113`, the build number is `2026011300 + 30 = 2026011330`

```bash
# Calculate build number (10 digits)
DATE=$(date +%Y%m%d)
BUILD_NUMBER=$((${DATE}00 + 30))
echo "Build number: $BUILD_NUMBER"  # Output: 2026011330
```

### Step 3: Create and Checkout Branch

Create a new branch named after the test version:

```bash
git checkout -b <test_version>
# Example: git checkout -b 9005.20.0
```

### Step 4: Modify Configuration Files

Modify the following files in order:

#### 4.1 Update `.env.version`

Change the `VERSION` field to the test version:

```
VERSION=<test_version>
BUNDLE_VERSION=1
```

#### 4.2 Update `.github/actions/shared-env/action.yml`

In the "Setup ENV BUILD_NUMBER" steps, replace ALL build number logic with a hardcoded value. Remove the if/else conditions and simplify to:

```yaml
- name: Setup ENV BUILD_NUMBER
  shell: bash
  run: |
    echo "BUILD_NUMBER=<calculated_build_number>" >> $GITHUB_ENV
```

Remove both:
- "Setup ENV BUILD_NUMBER to 1" step
- "Setup ENV BUILD_NUMBER by workflow_run" step

Replace with single step that hardcodes the build number.

#### 4.3 Update `.github/workflows/release-android.yml`

In the "Write .env.version" step, change:

```yaml
echo "BUILD_NUMBER=${{ env.BUILD_NUMBER }}" >> .env.version
```

To:

```yaml
echo "BUILD_NUMBER=<calculated_build_number>" >> .env.version
```

#### 4.4 Update `.github/workflows/release-ios.yml`

Same as release-android. In the "Write .env.version" step, change:

```yaml
echo "BUILD_NUMBER=${{ env.BUILD_NUMBER }}" >> .env.version
```

To:

```yaml
echo "BUILD_NUMBER=<calculated_build_number>" >> .env.version
```

#### 4.5 Update `.github/workflows/daily-build.yml`

In the "Setup ENV" step, replace the BUILD_NUMBER calculation logic with a hardcoded value:

```yaml
- name: 'Setup ENV'
  run: |
    echo "Executed at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "BUILD_NUMBER=<calculated_build_number>" >> $GITHUB_ENV
```

This ensures the entire CI pipeline from source to downstream workflows uses the same build number.

#### 4.6 Update `apps/mobile/android/app/build.gradle`

In the `defaultConfig` block, update:

```gradle
versionCode <calculated_build_number>
versionName "<test_version>"
```

Example:
```gradle
versionCode 2026011330
versionName "9005.20.0"
```

### Step 5: Commit and Push

```bash
git add -A
git commit -m "chore: prepare test version <test_version> with build number <build_number>"
git push -u origin <test_version>
```

## File Locations Summary

| File | Change |
|------|--------|
| `.env.version` | Update VERSION |
| `.github/actions/shared-env/action.yml` | Hardcode BUILD_NUMBER, remove conditionals |
| `.github/workflows/release-android.yml` | Hardcode BUILD_NUMBER in .env.version write |
| `.github/workflows/release-ios.yml` | Hardcode BUILD_NUMBER in .env.version write |
| `.github/workflows/daily-build.yml` | Hardcode BUILD_NUMBER in Setup ENV step |
| `apps/mobile/android/app/build.gradle` | Update versionCode and versionName |

## Validation Checklist

Before pushing, verify:
- [ ] Branch name matches test version
- [ ] `.env.version` VERSION field updated
- [ ] Build number conditionals removed from shared-env
- [ ] Build number hardcoded in release-android workflow
- [ ] Build number hardcoded in release-ios workflow
- [ ] Build number hardcoded in daily-build workflow
- [ ] versionCode is numeric (build number)
- [ ] versionName is quoted string (test version)
