# Foldable Split-View Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a user-controlled "Split view" toggle for tablets / Android foldables, with a one-time first-launch prompt and auto-restart on change.

**Architecture:** Persist `enableSplitView` in `settingsPersistAtom`; gate `provider/Container/index.tsx` on a new `useShouldUseSplitView()` hook. First-launch prompt is a `Bootstrap.tsx`-mounted side-effect component that uses `serviceSpotlight` (existing one-time-tour mechanism) to fire a `Dialog` once when the device becomes split-capable. Toggling the setting (or first-time prompt's choice if it differs from current mode) triggers `serviceApp.restartApp()`.

**Tech Stack:** TypeScript, React Native (iOS/Android/Web/Desktop), Tamagui via `@onekeyhq/components`, Jotai persistent atoms, OneKey background service RPC.

**Companion design doc:** `docs/plans/2026-05-07-foldable-split-mode-toggle-design.md` (read first if any task feels under-specified).

---

## Pre-flight checklist

- [ ] You are on branch `feat/foldable-split-view-toggle` (already created).
- [ ] You have read the companion design doc — particularly Sections 2 (reused mechanisms), 8 (trigger matrix), 9 (file change list).
- [ ] You understand the OneKey import hierarchy in `CLAUDE.md` — `kit-bg` cannot import from `kit` or `components`.
- [ ] All comments you write must be in **English** (per `1k-code-quality`).
- [ ] Run `yarn lint:staged` and `yarn tsc:staged` before each commit; do not bypass hooks.

## Conventions

- **Commit format:** `type: short description` (`feat`, `fix`, `refactor`, `chore`, `docs`).
- **No `any`, no `@ts-ignore`** — use real types.
- **No `Co-Authored-By` / `Generated with` lines.**
- After each task, run lint + tsc on touched files. Commit when green.

---

## Task 1: Register the spotlight tour enum

**Why first:** ServiceSpotlight needs the enum value before any code can call `isVisited` / `firstVisitTour`.

**Files:**
- Modify: `packages/shared/src/spotlight/index.ts` (or wherever `ESpotlightTour` is defined — confirm with `grep -rn "enum ESpotlightTour" packages/shared`).

**Step 1:** Locate the enum.

```bash
grep -rn "enum ESpotlightTour" packages/shared/src
```

**Step 2:** Add the new member, alphabetically placed.

```ts
export enum ESpotlightTour {
  // ... existing entries
  splitViewFirstPrompt = 'splitViewFirstPrompt',
}
```

**Step 3:** Type-check.

```bash
yarn tsc:staged
```
Expected: no new errors.

**Step 4:** Commit.

```bash
git add packages/shared/src/spotlight/index.ts
git commit -m "feat: add splitViewFirstPrompt spotlight tour"
```

---

## Task 2: Persist `enableSplitView` in settings atom

**Files:**
- Modify: `packages/kit-bg/src/states/jotai/atoms/settings.ts`

**Step 1:** Find `ISettingsPersistAtom` and `settingsAtomInitialValue`.

```bash
grep -n "ISettingsPersistAtom\|settingsAtomInitialValue" packages/kit-bg/src/states/jotai/atoms/settings.ts
```

**Step 2:** Add the optional field to the type.

```ts
// In ISettingsPersistAtom (group near other layout/UI prefs)
enableSplitView?: boolean;
```

**Step 3:** Do NOT add an initial value — `undefined` semantically means "default-on (split)". Hook readers will use `value !== false`.

This avoids a migration story for users who already shipped without this field.

**Step 4:** Type-check.

```bash
yarn tsc:staged
```

**Step 5:** Commit.

```bash
git add packages/kit-bg/src/states/jotai/atoms/settings.ts
git commit -m "feat: add enableSplitView field to settings atom"
```

---

## Task 3: Background setter for `enableSplitView`

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceSetting.ts`

**Step 1:** Find an existing simple setter (e.g. for `enableHaptics` or similar) and follow its pattern.

```bash
grep -n "@backgroundMethod" packages/kit-bg/src/services/ServiceSetting.ts | head -5
```

**Step 2:** Add the method near other appearance settings.

```ts
@backgroundMethod()
public async setEnableSplitView(value: boolean) {
  await settingsPersistAtom.set((prev) => ({
    ...prev,
    enableSplitView: value,
  }));
}
```

Do not call `restartApp()` here — UI owns restart timing for animation reasons.

**Step 3:** Type-check + lint.

```bash
yarn tsc:staged && yarn lint:staged
```

**Step 4:** Commit.

```bash
git add packages/kit-bg/src/services/ServiceSetting.ts
git commit -m "feat: add setEnableSplitView background method"
```

---

## Task 4: `useShouldUseSplitView` hook

**Files:**
- Create: `packages/kit/src/hooks/useShouldUseSplitView.ts`

**Step 1:** Write the hook.

```ts
import { isNativeTablet } from '@onekeyhq/components/src/hooks/useIsTablet';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// True when the user has split-view enabled AND the device can render it.
// Default-on: undefined / true → enabled, only explicit false disables.
export function useShouldUseSplitView(): boolean {
  const [{ enableSplitView }] = useSettingsPersistAtom();
  return isNativeTablet() && enableSplitView !== false;
}
```

**Step 2:** Verify the import paths resolve.

```bash
yarn tsc:staged
```

Confirm `isNativeTablet` is exported from `@onekeyhq/components`. If it's only an internal export, re-export it from the components index or import via the existing public path used by `Container/index.tsx`.

**Step 3:** Commit.

```bash
git add packages/kit/src/hooks/useShouldUseSplitView.ts
git commit -m "feat: add useShouldUseSplitView hook"
```

---

## Task 5: Wire the layout decision through the hook

**Files:**
- Modify: `packages/kit/src/provider/Container/index.tsx` (around lines 98–132 — the only place `isNativeTablet()` decides between `TableSplitViewContainer` and the single-pane router).

**Step 1:** Read the current decision block.

```bash
sed -n '90,140p' packages/kit/src/provider/Container/index.tsx
```

**Step 2:** Replace the `isNativeTablet()` call with the hook.

```diff
- import { isNativeTablet } from '...';
+ import { useShouldUseSplitView } from '@onekeyhq/kit/src/hooks/useShouldUseSplitView';

  function ContainerInner() {
-   if (isNativeTablet()) {
+   if (useShouldUseSplitView()) {
      return <TableSplitViewContainer ... />;
    }
    return <SingleDetailRouter ... />;
  }
```

Hook conformance: ensure the call sits at the top level of a React component, not inside a conditional.

**Step 3:** Type-check.

```bash
yarn tsc:staged
```

**Step 4:** Manual sanity: launch the iOS simulator targeting iPad and confirm split layout still renders.

```bash
yarn app:ios
```
(Pick an iPad simulator. Verify split view; verify changing nothing in settings doesn't regress.)

**Step 5:** Commit.

```bash
git add packages/kit/src/provider/Container/index.tsx
git commit -m "feat: gate split-view layout on useShouldUseSplitView"
```

---

## Task 6: Add i18n source keys

**Files:**
- Modify: source English locale file under `packages/shared/src/locale/enum/translations.ts` and the matching English JSON. (Confirm exact path with `grep -rn "settings_default_currency" packages/shared/src/locale`.)
- DO NOT edit auto-generated `translations.ts` if it carries an "auto-generated" header — find the source file the locale build uses.

**Step 1:** Add keys (English first; other locales auto-fill via the i18n pipeline).

| Key | English |
|---|---|
| `settings_split_view` | Split view |
| `settings_split_view_desc` | Show two columns side by side on tablets and foldable devices. App restarts when toggled. |
| `split_view_prompt_title` | Choose your layout |
| `split_view_prompt_body` | This device supports split view. Pick the experience you prefer — you can change it later in Settings. |
| `split_view_option_split` | Split view |
| `split_view_option_split_desc` | Two columns side by side |
| `split_view_option_single` | Single pane |
| `split_view_option_single_desc` | One column, classic feel |
| `split_view_recommended` | Recommended |
| `split_view_continue` | Continue |

**Step 2:** Run the locale codegen if the project has one.

```bash
yarn locale 2>/dev/null || echo "no yarn locale; check 1k-i18n skill"
```

If no codegen exists, English keys are sufficient — `formatMessage` falls back to the English source.

**Step 3:** Type-check (the `ETranslations` enum is generated and must pick up the new keys).

```bash
yarn tsc:staged
```

**Step 4:** Commit.

```bash
git add packages/shared/src/locale
git commit -m "feat: add i18n keys for split-view setting and prompt"
```

---

## Task 7: First-launch prompt component (effects only, dialog deferred)

**Files:**
- Create: `packages/kit/src/components/SplitViewPrompt/SplitViewPrompt.tsx`
- Create: `packages/kit/src/components/SplitViewPrompt/index.ts`

**Step 1:** Write the index barrel.

```ts
// packages/kit/src/components/SplitViewPrompt/index.ts
export { SplitViewPrompt } from './SplitViewPrompt';
```

**Step 2:** Write the effects component (dialog import is added in Task 8).

```tsx
// packages/kit/src/components/SplitViewPrompt/SplitViewPrompt.tsx
import { useEffect, useRef } from 'react';

import { isNativeTablet } from '@onekeyhq/components/src/hooks/useIsTablet';
import { useIsSpanningInDualScreen } from '@onekeyhq/shared/src/modules/DualScreenInfo';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { showSplitViewPromptDialog } from './showSplitViewPromptDialog';

export function SplitViewPrompt() {
  const isSpanning = useIsSpanningInDualScreen();
  const tablet = isNativeTablet();
  const [{ enableSplitView }] = useSettingsPersistAtom();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !tablet) return;

    const splitCapable = platformEnv.isNativeIOSPad || isSpanning;
    if (!splitCapable) return;

    firedRef.current = true;

    void (async () => {
      const visited = await backgroundApiProxy.serviceSpotlight.isVisited(
        ESpotlightTour.splitViewFirstPrompt,
      );
      if (visited) return;

      // Let splash dismissal animation finish first.
      await new Promise((r) => setTimeout(r, 800));

      showSplitViewPromptDialog({
        currentEnabled: enableSplitView !== false,
      });
    })();
  }, [tablet, isSpanning, enableSplitView]);

  return null;
}
```

**Step 3:** Verify imports resolve (component will not type-check yet — `showSplitViewPromptDialog` doesn't exist; that's the next task).

Skip `tsc:staged` until Task 8.

**Step 4:** No commit yet — bundle with Task 8.

---

## Task 8: First-launch prompt dialog UI

**Files:**
- Create: `packages/kit/src/components/SplitViewPrompt/showSplitViewPromptDialog.tsx`

**Step 1:** Look at an existing two-card-choice dialog in the codebase for visual reference.

```bash
grep -rn "Dialog.show" packages/kit/src --include="*.tsx" | head
```

Pick a precedent that uses a custom `renderContent`.

**Step 2:** Implement.

```tsx
// packages/kit/src/components/SplitViewPrompt/showSplitViewPromptDialog.tsx
import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Dialog,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESpotlightTour } from '@onekeyhq/shared/src/spotlight';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

type IMode = 'split' | 'single';

function PromptContent({
  initialMode,
  onConfirm,
}: {
  initialMode: IMode;
  onConfirm: (m: IMode) => void;
}) {
  const intl = useIntl();
  const [picked, setPicked] = useState<IMode>(initialMode);

  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.split_view_prompt_body })}
      </SizableText>

      <XStack gap="$3" $md={{ flexDirection: 'column' }}>
        {(['split', 'single'] as const).map((mode) => {
          const active = picked === mode;
          return (
            <Stack
              key={mode}
              flex={1}
              p="$4"
              gap="$2"
              borderRadius="$3"
              borderWidth={2}
              borderColor={active ? '$borderActive' : '$borderSubdued'}
              hoverStyle={{ borderColor: '$borderActive' }}
              onPress={() => setPicked(mode)}
              cursor="pointer"
            >
              <Icon
                name={mode === 'split' ? 'LayoutGridSolid' : 'SquareOutline'}
                size="$8"
                color="$iconActive"
              />
              <XStack gap="$2" alignItems="center">
                <SizableText size="$bodyLgMedium">
                  {intl.formatMessage({
                    id:
                      mode === 'split'
                        ? ETranslations.split_view_option_split
                        : ETranslations.split_view_option_single,
                  })}
                </SizableText>
                {mode === 'split' ? (
                  <Badge badgeType="info" badgeSize="sm">
                    {intl.formatMessage({
                      id: ETranslations.split_view_recommended,
                    })}
                  </Badge>
                ) : null}
              </XStack>
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage({
                  id:
                    mode === 'split'
                      ? ETranslations.split_view_option_split_desc
                      : ETranslations.split_view_option_single_desc,
                })}
              </SizableText>
            </Stack>
          );
        })}
      </XStack>
    </YStack>
  );
}

export function showSplitViewPromptDialog({
  currentEnabled,
}: {
  currentEnabled: boolean;
}) {
  let picked: IMode = currentEnabled ? 'split' : 'single';

  Dialog.show({
    title: undefined, // We use prompt_title via the body header below
    icon: 'LayoutGridSolid',
    showCancelButton: false,
    dismissOnOverlayPress: false,
    renderContent: (
      <PromptContent
        initialMode={picked}
        onConfirm={(m) => {
          picked = m;
        }}
      />
    ),
    onConfirmText: 'Continue', // Replace with intl in next iteration if Dialog API allows
    onConfirm: async ({ close }) => {
      await backgroundApiProxy.serviceSpotlight.firstVisitTour(
        ESpotlightTour.splitViewFirstPrompt,
      );

      const targetEnabled = picked === 'split';
      if (targetEnabled === currentEnabled) {
        await close();
        return;
      }

      await backgroundApiProxy.serviceSetting.setEnableSplitView(targetEnabled);
      await close();
      setTimeout(() => {
        void backgroundApiProxy.serviceApp.restartApp();
      }, 300);
    },
  });
}
```

Note: the exact `Dialog.show` API signature varies — read `packages/components/src/composite/Dialog` and adjust prop names (`renderContent` vs `content`, `onConfirmText` localization, etc.).

**Step 3:** Type-check.

```bash
yarn tsc:staged
```
Fix any prop mismatches against the actual `Dialog` API.

**Step 4:** Lint.

```bash
yarn lint:staged
```

**Step 5:** Commit Tasks 7 + 8 together.

```bash
git add packages/kit/src/components/SplitViewPrompt
git commit -m "feat: add first-launch split-view prompt dialog"
```

---

## Task 9: Mount the prompt in Bootstrap

**Files:**
- Modify: `packages/kit/src/provider/Bootstrap.tsx`

**Step 1:** Read the file's render structure.

```bash
grep -n "useLaunchEvents\|return null\|export" packages/kit/src/provider/Bootstrap.tsx | head
```

**Step 2:** Mount `<SplitViewPrompt />` near other side-effect components (search for similar mounts like `<FloatingButton />` or other already-mounted prompts).

```diff
+ import { SplitViewPrompt } from '@onekeyhq/kit/src/components/SplitViewPrompt';

  // inside Bootstrap's return:
+ <SplitViewPrompt />
```

If `Bootstrap` returns `null`, append `<SplitViewPrompt />` as a sibling within a Fragment.

**Step 3:** Type-check.

```bash
yarn tsc:staged
```

**Step 4:** Manual smoke: launch on iPad simulator with a clean install (or clear `spotlightPersistAtom` storage). Verify the dialog appears after splash. Pick "Single" → app restarts → confirm single-pane layout.

```bash
yarn app:ios
```

**Step 5:** Commit.

```bash
git add packages/kit/src/provider/Bootstrap.tsx
git commit -m "feat: mount SplitViewPrompt in Bootstrap"
```

---

## Task 10: Settings list item

**Files:**
- Modify: `packages/kit/src/views/Setting/pages/Tab/CustomElement.tsx`
- Modify: `packages/kit/src/views/Setting/pages/Tab/config.tsx`

**Step 1:** In `CustomElement.tsx`, mirror an existing toggle (e.g. `BTCFreshAddressListItem` ~line 776 or `UseGasAccountByDefaultListItem` ~798).

```tsx
export function SplitViewListItem(props: ICustomElementProps) {
  const intl = useIntl();
  const [{ enableSplitView }] = useSettingsPersistAtom();
  const checked = enableSplitView !== false;

  const onToggle = useCallback(
    async (next: boolean) => {
      if (next === checked) return;
      await backgroundApiProxy.serviceSetting.setEnableSplitView(next);
      setTimeout(() => {
        void backgroundApiProxy.serviceApp.restartApp();
      }, 200);
    },
    [checked],
  );

  if (!isNativeTablet()) return null;

  return (
    <TabSettingsListItem
      {...props}
      icon="LayoutGridSolid"
      title={intl.formatMessage({ id: ETranslations.settings_split_view })}
      subtitle={intl.formatMessage({
        id: ETranslations.settings_split_view_desc,
      })}
      userSelect="none"
    >
      <Switch
        size={ESwitchSize.small}
        value={checked}
        onChange={onToggle}
      />
    </TabSettingsListItem>
  );
}
```

**Step 2:** In `config.tsx`, register the row inside the **Appearance** group (same group as theme/language). Find the group with `grep -n "appearance\|theme\|language" packages/kit/src/views/Setting/pages/Tab/config.tsx`.

```tsx
{
  title: intl.formatMessage({ id: ETranslations.settings_split_view }),
  renderElement: <SplitViewListItem />,
}
```

If the config file uses a different shape (icon-only, custom element only), match the surrounding entries.

**Step 3:** Type-check + lint.

```bash
yarn tsc:staged && yarn lint:staged
```

**Step 4:** Manual: open Settings on iPad, toggle Split view off → app restarts → single-pane. Toggle on → restarts → split. Verify the row is hidden on iPhone build.

**Step 5:** Commit.

```bash
git add packages/kit/src/views/Setting/pages/Tab
git commit -m "feat: add Split view toggle to Settings"
```

---

## Task 11: Manual verification matrix

Run through the trigger matrix from Section 8 of the design doc. Document each result as a one-line note in the PR description.

| Device | Expected | Verified? |
|---|---|---|
| iPhone | No prompt, no settings row | |
| iPad fresh install | Prompt after splash; choose Split → no restart | |
| iPad fresh install | Choose Single → restart → single layout | |
| iPad after first launch | Settings toggle off → restart → single | |
| iPad after first launch | Settings toggle on → restart → split | |
| Android phone | No prompt, no settings row | |
| Android foldable folded | No prompt while folded | |
| Android foldable unfolded at launch | Prompt fires after splash | |
| Android foldable, unfold later | Prompt fires on unfold | |

If a row fails, return to the relevant task and fix before merging.

---

## Task 12: Open the PR

**Step 1:** Push the branch.

```bash
git push -u origin feat/foldable-split-view-toggle
```

**Step 2:** Open the PR against `x` with the verification matrix in the body.

```bash
gh pr create --base x --title "feat: add split-view toggle for tablets and foldables" --body "$(cat <<'EOF'
## Summary
- Adds Settings → Appearance → Split view toggle (visible on iPad / Android foldable only).
- Adds first-launch prompt asking the user to choose split vs single mode the first time the device is in a split-capable state.
- Toggling the setting (or first-time prompt picking a non-default value) auto-restarts the app.

Companion design doc: `docs/plans/2026-05-07-foldable-split-mode-toggle-design.md`.

## Test plan
- [ ] iPhone: no prompt, no settings row
- [ ] iPad fresh install: prompt fires after splash, picking Split keeps current layout
- [ ] iPad fresh install: picking Single restarts → single layout
- [ ] iPad: Settings toggle off restarts → single
- [ ] iPad: Settings toggle on restarts → split
- [ ] Android phone: no prompt, no settings row
- [ ] Android foldable folded → no prompt
- [ ] Android foldable unfolded at launch → prompt fires
- [ ] Android foldable, unfold mid-session → prompt fires once
EOF
)"
```

---

## Rollback

If anything regresses on phones (which should never see this code path), the safest revert is `git revert` of the merge commit. The `enableSplitView` field in the persisted atom is non-breaking — older builds without the field will simply not read it.
