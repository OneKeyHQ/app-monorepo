# Foldable / Tablet Split-View Toggle — Design

Date: 2026-05-07
Owner: huhuanming
Status: Draft (pending implementation)

## 1. Background & Goals

OneKey currently force-enables a two-column "split view" layout on every tablet-class device — iPad and Android foldables (when unfolded / spanning). Some users dislike the split layout and want to use single-pane mode on these devices.

Goals:

1. Add a user-controlled toggle in **Settings** to enable/disable split-view mode. Visible only on devices that *can* split.
2. On the user's first split-capable session, surface a one-time prompt offering the choice. Default = split mode.
3. Provide a polished UI with clear visual differentiation between the two modes.
4. Toggling the setting (after first launch) automatically restarts the app, since the layout container can't safely hot-swap.

Scope:

- **Eligible devices**: any device for which `isNativeTablet()` returns true → iPad + Android foldables.
- iPad always treats itself as "split-capable"; Android foldable is split-capable only when `spanning` (unfolded with the seam crossing both halves).
- All other phones: unchanged. No setting, no prompt.

## 2. Existing Mechanisms (Reused)

| Concern | Reused API | File |
|---|---|---|
| Detect tablet/foldable | `isNativeTablet()` | `packages/components/src/hooks/useIsTablet.ts` |
| Detect Android foldable spanning | `useIsSpanningInDualScreen()` | `packages/shared/src/modules/DualScreenInfo/index.android.ts` |
| Layout split decision | `Container/index.tsx:98-132` (currently calls `isNativeTablet()`) | `packages/kit/src/provider/Container/index.tsx` |
| Persisted settings | `settingsPersistAtom` + `useSettingsPersistAtom()` | `packages/kit-bg/src/states/jotai/atoms/settings.ts` |
| Restart app | `serviceApp.restartApp()` | `packages/kit-bg/src/services/ServiceApp.ts:60-77` |
| One-time prompt tracking | `ESpotlightTour` + `serviceSpotlight.isVisited / firstVisitTour` | `packages/kit-bg/src/services/ServiceSpotlight.ts` |
| Atom hydration gate | `<GlobalJotaiReady>` already wraps app at `provider/index.tsx:162` | `packages/kit/src/components/GlobalJotaiReady/GlobalJotaiReady.tsx` |
| Splash dismiss event | `appEventBus` `HomePageReady` | `packages/kit/src/provider/SplashProvider.tsx:121` |

## 3. Data Model Changes

### 3.1 `settingsPersistAtom`

`packages/kit-bg/src/states/jotai/atoms/settings.ts`

```ts
// ISettingsPersistAtom
enableSplitView?: boolean; // undefined treated as `true`
```

`enableSplitView` is the only persisted bit we need. The "has user been prompted" flag uses the existing `spotlightPersistAtom` pattern instead of a new field — keeps settings atom uncluttered.

Initial value omitted (defaults to undefined → split-mode on, matching current behavior).

### 3.2 `ESpotlightTour`

`packages/shared/src/spotlight/index.ts`

```ts
export enum ESpotlightTour {
  // ... existing
  splitViewFirstPrompt = 'splitViewFirstPrompt',
}
```

### 3.3 `ServiceSetting` new method

`packages/kit-bg/src/services/ServiceSetting.ts`

```ts
@backgroundMethod()
public async setEnableSplitView(value: boolean) {
  await settingsPersistAtom.set((prev) => ({
    ...prev,
    enableSplitView: value,
  }));
}
```

No need to wrap restart inside this method — let the UI layer decide when to restart so confirmation/animation flows are owned by the view.

## 4. Layout Decision

### 4.1 New hook: `useShouldUseSplitView()`

`packages/kit/src/hooks/useShouldUseSplitView.ts` (new file)

```ts
export function useShouldUseSplitView() {
  const [{ enableSplitView }] = useSettingsPersistAtom();
  // undefined → true (default-on); explicit false → off
  return isNativeTablet() && enableSplitView !== false;
}
```

### 4.2 Container wiring

`packages/kit/src/provider/Container/index.tsx:98-132`

Replace the single call site:

```diff
- isNativeTablet() ? <TableSplitViewContainer /> : <SingleDetailRouter />
+ useShouldUseSplitView() ? <TableSplitViewContainer /> : <SingleDetailRouter />
```

This is the only render branch we need to touch. `TableSplitViewContainer` itself still uses `useIsSplitView()` internally, which is fine — when single-mode is selected, we never even mount `TableSplitViewContainer`, so its internal logic is irrelevant.

Because changes only take effect via `restartApp()`, we don't need any unmount/remount transition logic.

## 5. First-Time Prompt

### 5.1 Component: `SplitViewPrompt`

`packages/kit/src/components/SplitViewPrompt/SplitViewPrompt.tsx` (new file)

Mounted in `Bootstrap.tsx` next to existing `useLaunchEvents()`. Renders nothing visually — only effects.

```ts
export function SplitViewPrompt() {
  const isSpanning = useIsSpanningInDualScreen();
  const isTablet = isNativeTablet();
  const [{ enableSplitView }] = useSettingsPersistAtom();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || !isTablet) return;

    // iPad: split-capable on launch.
    // Android foldable: only when actually spanning (unfolded).
    const splitCapable = platformEnv.isNativeIOSPad || isSpanning;
    if (!splitCapable) return;

    firedRef.current = true; // guard double-fire across re-renders

    void (async () => {
      const visited = await backgroundApiProxy.serviceSpotlight
        .isVisited(ESpotlightTour.splitViewFirstPrompt);
      if (visited) return;

      // Wait until splash animation finished, otherwise the dialog
      // animation collides with splash dismissal (SplashProvider.tsx:121).
      await waitHomePageReadyOrTimeout(800);

      showSplitViewPromptDialog({
        currentMode: enableSplitView !== false ? 'split' : 'single',
      });
    })();
  }, [isTablet, isSpanning, enableSplitView]);

  return null;
}
```

`waitHomePageReadyOrTimeout(ms)` is a small helper that resolves on the first `HomePageReady` event or after `ms` ms, whichever first.

### 5.2 Why we don't need an explicit "background ready" await

`Bootstrap.tsx` is rendered as a descendant of `<GlobalJotaiReady>` in `provider/index.tsx:162`. By the time any component below renders, atoms are hydrated. Therefore:

- `useSettingsPersistAtom()` returns the persisted value on first render.
- `serviceSpotlight.isVisited()` reads from the already-hydrated `spotlightPersistAtom`.

No extra promise-await is needed.

### 5.3 Dialog UI

`showSplitViewPromptDialog({ currentMode })` opens a non-dismissable `Dialog.show` with:

```
┌──────────────────────────────────────────────┐
│  Choose your layout                          │
│  This device supports split view. Pick the   │
│  experience you prefer — you can change it   │
│  later in Settings.                          │
│                                              │
│  ┌──────────────┐   ┌──────────────┐         │
│  │  [icon: ▮▯]  │   │  [icon: ▮ ]  │         │
│  │  Split View  │   │ Single Pane  │         │
│  │ (Recommended)│   │              │         │
│  │  Two columns │   │  One column, │         │
│  │  side by side│   │  classic feel│         │
│  └──────────────┘   └──────────────┘         │
└──────────────────────────────────────────────┘
```

Implementation notes:

- Two `Pressable` cards laid out via `XStack` on iPad / wide foldable, fall back to `YStack` if width tight.
- Selected card gets a colored border + check badge; "Recommended" tag on Split View.
- Bottom-right primary button "Continue" — disabled until a card is tapped (default-selected = current mode, so always enabled).
- Cards use simple SVG/icon mockups already in `@onekeyhq/components` (e.g. `IconAlignLeft`, `IconColumns`) — no design assets needed.

On `Continue`:

```ts
await backgroundApiProxy.serviceSpotlight
  .firstVisitTour(ESpotlightTour.splitViewFirstPrompt);

const targetEnabled = picked === 'split';
const currentEnabled = enableSplitView !== false;

if (targetEnabled === currentEnabled) {
  // No actual change — close and we're done.
  return;
}

await backgroundApiProxy.serviceSetting.setEnableSplitView(targetEnabled);
// brief 300ms delay so the Dialog close animation can play before nuke
setTimeout(() => {
  void backgroundApiProxy.serviceApp.restartApp();
}, 300);
```

## 6. Settings Page Toggle

### 6.1 Visibility rule

Only mount the row when `isNativeTablet()` is true. Phones never see it.

### 6.2 Location

`packages/kit/src/views/Setting/pages/Tab/config.tsx` (existing config-driven settings)
+ `packages/kit/src/views/Setting/pages/Tab/CustomElement.tsx` (new `SplitViewListItem`)

Place under the **Appearance** group (same group as Theme/Language) — this is a layout/visual preference.

### 6.3 Toggle behavior — auto-restart on change

```ts
function SplitViewListItem(props) {
  const intl = useIntl();
  const [{ enableSplitView }] = useSettingsPersistAtom();
  const checked = enableSplitView !== false;

  const onToggle = useCallback(async (next: boolean) => {
    if (next === checked) return;
    await backgroundApiProxy.serviceSetting.setEnableSplitView(next);
    // Immediate auto-restart per requirement (4).
    setTimeout(() => {
      void backgroundApiProxy.serviceApp.restartApp();
    }, 200);
  }, [checked]);

  if (!isNativeTablet()) return null;

  return (
    <TabSettingsListItem
      icon="LayoutGridSolid"
      title={intl.formatMessage({ id: ETranslations.settings_split_view })}
      subtitle={intl.formatMessage({ id: ETranslations.settings_split_view_desc })}
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

The 200ms delay gives the Switch its toggle animation a frame before native restart kicks in — purely cosmetic.

No confirmation dialog: the user explicitly chose "auto-restart on switch" in design Q3. If telemetry later shows accidental taps, we can add a 3-second undo toast before restart, but ship the simple version first.

## 7. i18n Keys

Add to translations source (run `yarn locale` after to regen):

| Key | English |
|---|---|
| `settings_split_view` | Split view |
| `settings_split_view_desc` | Show two columns side by side on tablets and foldables. App restarts when toggled. |
| `split_view_prompt_title` | Choose your layout |
| `split_view_prompt_body` | This device supports split view. Pick the experience you prefer — you can change it later in Settings. |
| `split_view_option_split` | Split view |
| `split_view_option_split_desc` | Two columns side by side |
| `split_view_option_single` | Single pane |
| `split_view_option_single_desc` | One column, classic feel |
| `split_view_recommended` | Recommended |
| `split_view_continue` | Continue |

## 8. Trigger Matrix (sanity check)

| Device | First launch state | Prompt fires? | Initial layout |
|---|---|---|---|
| iPhone | n/a | No | Single (existing) |
| iPad | App opened | Yes (after splash) | Split |
| Android phone | n/a | No | Single (existing) |
| Android foldable, folded | App opened folded | No (waits for unfold) | Single |
| Android foldable, unfolded at launch | `isSpanning=true` on first render | Yes | Split |
| Android foldable, unfolds later | `isSpanning` flips false→true | Yes (effect re-runs) | Was single, becomes split via existing useIsSplitView |
| Tablet, already prompted | `serviceSpotlight.isVisited`=true | No | Honors saved `enableSplitView` |

## 9. File Change List

New:

- `packages/kit/src/hooks/useShouldUseSplitView.ts`
- `packages/kit/src/components/SplitViewPrompt/SplitViewPrompt.tsx`
- `packages/kit/src/components/SplitViewPrompt/showSplitViewPromptDialog.tsx`
- `packages/kit/src/components/SplitViewPrompt/index.ts`

Edited:

- `packages/kit-bg/src/states/jotai/atoms/settings.ts` — add `enableSplitView` field to type.
- `packages/kit-bg/src/services/ServiceSetting.ts` — add `setEnableSplitView`.
- `packages/shared/src/spotlight/index.ts` — add `splitViewFirstPrompt` enum.
- `packages/kit/src/provider/Container/index.tsx` — swap `isNativeTablet()` call site for the new hook.
- `packages/kit/src/provider/Bootstrap.tsx` — mount `<SplitViewPrompt />`.
- `packages/kit/src/views/Setting/pages/Tab/CustomElement.tsx` — add `SplitViewListItem`.
- `packages/kit/src/views/Setting/pages/Tab/config.tsx` — register the row under Appearance group.
- Translation source files (English first, others follow auto-translation pipeline).

## 10. Edge Cases & Open Questions

1. **iPad + external monitor / Stage Manager**: `isNativeTablet()` stays true regardless. No special handling — user setting still rules.
2. **Android tablet (non-foldable, e.g. Pixel Tablet)**: `isNativeTablet()` returns true via `Device.deviceType`. The prompt fires immediately on launch (since `isSpanning` is false on a regular tablet). This matches the chosen "all split-capable devices" scope.
3. **Restart during background sync**: `restartApp()` already used for "Reset App" — no known data-loss issues with foreground state. Pending hardware-wallet calls would be aborted; user is expected to choose layout when not mid-flow.
4. **Race**: user opens Settings → toggles → app restarts mid-Settings. Acceptable; on relaunch user lands on home, can re-enter Settings if needed.
5. **Web / Desktop / Extension**: `isNativeTablet()` is false. Hook returns false. Existing web responsive layout (`useIsWebHorizontalLayout`) untouched.

## 11. Out of Scope

- Live in-app layout switch without restart. Container tree depends on the boolean at mount time; remounting it cleanly across split↔single while preserving deep navigation state is its own multi-week project.
- Per-feature granularity (e.g. "split view for Wallet only"). Single global toggle.
- Migrating the Container layout away from `isNativeTablet()` for non-foldable cases.

## 12. Test Plan

Manual:

- iPad: fresh install → see prompt after splash → choose Split → no restart, app proceeds split. Re-open app → no prompt. Settings toggle off → restart → single layout. Settings toggle on → restart → split.
- iPad: fresh install → choose Single in prompt → app restarts → layout is single. Settings toggle on → restart → split.
- Android foldable (Z Fold): launch folded → no prompt → unfold → prompt fires. Choose Split → no restart. Re-fold → re-unfold → no prompt.
- Android foldable: launch unfolded → prompt fires immediately after splash.
- Android phone: never see the prompt or settings row.
- iPhone: never see the prompt or settings row.

Automated:

- Unit test `useShouldUseSplitView` against `(isNativeTablet, enableSplitView)` × {true,false} × {true,false,undefined}.

