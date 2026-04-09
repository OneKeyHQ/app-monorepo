# Featured Changelog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current WhatsNew/UpdatePreview changelog modals with a Featured Changelog overlay that showcases 1-3 curated version highlights with media, tab switching, and contextual CTAs.

**Architecture:** New `FeaturedChangelog` screen in the existing `AppUpdateModal` navigation stack. The trigger logic in `UpdateReminder/hooks.tsx` checks for featured config from the backend API; if present, routes to the new screen instead of WhatsNew/UpdatePreview. Falls back to existing behavior when no featured config exists. Data model extends `IAppUpdateInfo` with an optional `featuredChangelog` field.

**Tech Stack:** React Native, TypeScript, Tamagui (`@onekeyhq/components`), Jotai atoms, `expo-image`, `react-native-video`

**Spec:** `docs/superpowers/specs/2026-04-09-featured-changelog-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/shared/src/appUpdate/featuredChangelog.ts` | Types + helper utilities for featured changelog |
| Modify | `packages/shared/src/appUpdate/type.ts` | Extend `IAppUpdateInfo` with `featuredChangelog` field |
| Modify | `packages/shared/src/appUpdate/index.ts` | Re-export new types |
| Modify | `packages/shared/src/routes/appUpdate.ts` | Add `FeaturedChangelog` route + param type |
| Modify | `packages/kit/src/views/AppUpdate/router/index.ts` | Register new screen |
| Create | `packages/kit/src/views/AppUpdate/pages/FeaturedChangelog.tsx` | Main page component |
| Create | `packages/kit/src/views/AppUpdate/components/FeaturedTabBar.tsx` | Pill-style tab bar |
| Create | `packages/kit/src/views/AppUpdate/components/FeaturedMedia.tsx` | Image/Video media area |
| Create | `packages/kit/src/views/AppUpdate/components/FeaturedFooter.tsx` | Custom responsive footer |
| Modify | `packages/kit/src/components/UpdateReminder/hooks.tsx` | Modify trigger logic to route to FeaturedChangelog |
| Modify | `packages/kit-bg/src/services/ServiceAppUpdate.ts` | Parse featured changelog from API response |

---

## Task 1: Types and Data Model

**Files:**
- Create: `packages/shared/src/appUpdate/featuredChangelog.ts`
- Modify: `packages/shared/src/appUpdate/type.ts`
- Modify: `packages/shared/src/appUpdate/index.ts`

- [ ] **Step 1: Create featured changelog types**

```typescript
// packages/shared/src/appUpdate/featuredChangelog.ts

export interface IFeaturedItem {
  tabLabel: string;       // Tab pill text, e.g. "⚡ 0 手续费"
  title: string;          // Feature title, ≤15 chars
  description: string;    // Feature description, ≤40 chars
  mediaUrl: string;       // Remote image or video URL
  mediaType: 'image' | 'video';
  ctaText: string;        // CTA button text, e.g. "立即体验"
  ctaDeeplink: string;    // Deep link for CTA action
}

export interface IFeaturedChangelog {
  version: string;              // Target version, e.g. "6.1.0"
  features: IFeaturedItem[];    // 1-3 items, ordered by priority
}

export function hasFeaturedChangelog(
  featuredChangelog: IFeaturedChangelog | undefined,
): featuredChangelog is IFeaturedChangelog {
  return (
    !!featuredChangelog &&
    Array.isArray(featuredChangelog.features) &&
    featuredChangelog.features.length > 0
  );
}
```

- [ ] **Step 2: Extend IAppUpdateInfo**

In `packages/shared/src/appUpdate/type.ts`, add the `featuredChangelog` field to the `IAppUpdateInfo` interface:

```typescript
// Add import at top
import type { IFeaturedChangelog } from './featuredChangelog';

// Add to IAppUpdateInfo interface:
  featuredChangelog?: IFeaturedChangelog;
```

- [ ] **Step 3: Re-export from index**

In `packages/shared/src/appUpdate/index.ts`, add:

```typescript
export {
  type IFeaturedItem,
  type IFeaturedChangelog,
  hasFeaturedChangelog,
} from './featuredChangelog';
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/appUpdate/featuredChangelog.ts \
       packages/shared/src/appUpdate/type.ts \
       packages/shared/src/appUpdate/index.ts
git commit -m "feat(appUpdate): add featured changelog types (OK-52369)"
```

---

## Task 2: Route Registration

**Files:**
- Modify: `packages/shared/src/routes/appUpdate.ts`
- Modify: `packages/kit/src/views/AppUpdate/router/index.ts`

- [ ] **Step 1: Add route enum and param type**

In `packages/shared/src/routes/appUpdate.ts`:

```typescript
// Add to EAppUpdateRoutes enum:
  FeaturedChangelog = 'FeaturedChangelog',

// Add to IAppUpdatePagesParamList type:
  [EAppUpdateRoutes.FeaturedChangelog]: {
    isPreInstall?: boolean;  // true = show "Update" CTA, false = show feature CTA
    latestVersion?: string;
    isForceUpdate?: boolean;
  };
```

- [ ] **Step 2: Register screen in router**

In `packages/kit/src/views/AppUpdate/router/index.ts`:

```typescript
// Add lazy import alongside existing ones:
const FeaturedChangelogPage = LazyLoadPage(
  () => import('../pages/FeaturedChangelog'),
);

// Add to AppUpdateRouter array (before UpdatePreview):
  {
    name: EAppUpdateRoutes.FeaturedChangelog,
    component: FeaturedChangelogPage,
  },
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/routes/appUpdate.ts \
       packages/kit/src/views/AppUpdate/router/index.ts
git commit -m "feat(appUpdate): register FeaturedChangelog route (OK-52369)"
```

---

## Task 3: FeaturedTabBar Component

**Files:**
- Create: `packages/kit/src/views/AppUpdate/components/FeaturedTabBar.tsx`

- [ ] **Step 1: Create pill-style tab bar**

```typescript
// packages/kit/src/views/AppUpdate/components/FeaturedTabBar.tsx

import { useCallback } from 'react';

import { Button, XStack } from '@onekeyhq/components';

import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';

interface IFeaturedTabBarProps {
  features: IFeaturedItem[];
  activeIndex: number;
  onTabPress: (index: number) => void;
}

function FeaturedTabBar({
  features,
  activeIndex,
  onTabPress,
}: IFeaturedTabBarProps) {
  const handlePress = useCallback(
    (index: number) => () => {
      onTabPress(index);
    },
    [onTabPress],
  );

  if (features.length <= 1) {
    return null;
  }

  return (
    <XStack gap="$2" flexWrap="wrap" mb="$3">
      {features.map((feature, index) => (
        <Button
          key={index}
          size="small"
          variant={index === activeIndex ? 'primary' : 'secondary'}
          borderRadius="$full"
          onPress={handlePress(index)}
        >
          {feature.tabLabel}
        </Button>
      ))}
    </XStack>
  );
}

export { FeaturedTabBar };
```

- [ ] **Step 2: Commit**

```bash
git add packages/kit/src/views/AppUpdate/components/FeaturedTabBar.tsx
git commit -m "feat(appUpdate): add FeaturedTabBar pill component (OK-52369)"
```

---

## Task 4: FeaturedMedia Component

**Files:**
- Create: `packages/kit/src/views/AppUpdate/components/FeaturedMedia.tsx`

- [ ] **Step 1: Create media component with Image/Video support**

```typescript
// packages/kit/src/views/AppUpdate/components/FeaturedMedia.tsx

import { useEffect, useRef } from 'react';

import { Image, Skeleton, Stack, Video } from '@onekeyhq/components';

import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';

interface IFeaturedMediaProps {
  feature: IFeaturedItem;
}

function FeaturedMedia({ feature }: IFeaturedMediaProps) {
  const videoRef = useRef<{ seek?: (time: number) => void }>(null);

  useEffect(() => {
    // Reset video to start when feature changes
    if (feature.mediaType === 'video' && videoRef.current?.seek) {
      videoRef.current.seek(0);
    }
  }, [feature]);

  return (
    <Stack
      borderRadius="$3"
      overflow="hidden"
      mb="$3"
      bg="$bgSubdued"
      aspectRatio={16 / 9}
    >
      {feature.mediaType === 'video' ? (
        <Video
          ref={videoRef}
          source={{ uri: feature.mediaUrl }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          repeat
          muted
        />
      ) : (
        <Image
          src={feature.mediaUrl}
          width="100%"
          height="100%"
          resizeMode="cover"
        >
          <Image.Fallback>
            <Skeleton width="100%" height="100%" />
          </Image.Fallback>
          <Image.Loading>
            <Skeleton width="100%" height="100%" />
          </Image.Loading>
        </Image>
      )}
    </Stack>
  );
}

export { FeaturedMedia };
```

- [ ] **Step 2: Commit**

```bash
git add packages/kit/src/views/AppUpdate/components/FeaturedMedia.tsx
git commit -m "feat(appUpdate): add FeaturedMedia image/video component (OK-52369)"
```

---

## Task 5: FeaturedFooter Component

**Files:**
- Create: `packages/kit/src/views/AppUpdate/components/FeaturedFooter.tsx`

The spec requires: large screen = changelog link LEFT + CTA RIGHT; small screen = CTA on top + link below. `Page.Footer` doesn't have a built-in left-side content prop, so we use `Page.Footer` with `children` for a custom responsive layout.

- [ ] **Step 1: Create responsive footer**

```typescript
// packages/kit/src/views/AppUpdate/components/FeaturedFooter.tsx

import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../../hooks/useAppNavigation';

interface IFeaturedFooterProps {
  ctaText: string;
  onCtaPress: () => void;
  isForceUpdate?: boolean;
}

function FeaturedFooter({
  ctaText,
  onCtaPress,
  isForceUpdate,
}: IFeaturedFooterProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleViewChangelog = useCallback(() => {
    navigation.push(EAppUpdateRoutes.WhatsNew);
  }, [navigation]);

  return (
    <Page.Footer>
      {/* 
        Custom responsive layout:
        - Small screen: CTA full-width on top, changelog link centered below
        - Large screen ($gtMd): row layout, link left, CTA right
      */}
      <YStack
        p="$5"
        pt="$0"
        gap="$3"
        $gtMd={{
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Changelog link — renders below CTA on mobile, left on desktop */}
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          textAlign="center"
          cursor="pointer"
          hoverStyle={{ color: '$textInteractive' }}
          pressStyle={{ opacity: 0.7 }}
          onPress={handleViewChangelog}
          $gtMd={{
            order: -1,
            textAlign: 'left',
            flex: 1,
          }}
        >
          {intl.formatMessage({
            id: ETranslations.update_view_full_changelog,
          })}{' '}
          ›
        </SizableText>
        {/* Primary CTA */}
        <Button
          variant="primary"
          size="large"
          onPress={onCtaPress}
          $gtMd={{
            flexGrow: 0,
            minWidth: 160,
          }}
        >
          {ctaText}
        </Button>
      </YStack>
    </Page.Footer>
  );
}

export { FeaturedFooter };
```

> **Note:** The i18n key `ETranslations.update_view_full_changelog` needs to be created on Lokalise first (`yarn fetch:locale` to pull). For development, use a hardcoded fallback string.

- [ ] **Step 2: Commit**

```bash
git add packages/kit/src/views/AppUpdate/components/FeaturedFooter.tsx
git commit -m "feat(appUpdate): add FeaturedFooter responsive component (OK-52369)"
```

---

## Task 6: FeaturedChangelog Page

**Files:**
- Create: `packages/kit/src/views/AppUpdate/pages/FeaturedChangelog.tsx`

- [ ] **Step 1: Create the main page component**

```typescript
// packages/kit/src/views/AppUpdate/pages/FeaturedChangelog.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePreventRemove } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Badge,
  Page,
  ScrollView,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  displayAppUpdateVersion,
  displayWhatsNewVersion,
  hasFeaturedChangelog,
} from '@onekeyhq/shared/src/appUpdate';
import type { IFeaturedItem } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EAppUpdateRoutes,
  IAppUpdatePagesParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { isForceUpdateStrategy } from '../../../components/UpdateReminder/hooks';
import { FeaturedFooter } from '../components/FeaturedFooter';
import { FeaturedMedia } from '../components/FeaturedMedia';
import { FeaturedTabBar } from '../components/FeaturedTabBar';

function FeaturedChangelog({
  route,
}: IPageScreenProps<
  IAppUpdatePagesParamList,
  EAppUpdateRoutes.FeaturedChangelog
>) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { isPreInstall = false, isForceUpdate: isForceUpdateParam, latestVersion } =
    route.params || {};

  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const [activeIndex, setActiveIndex] = useState(0);
  const mountTimeRef = useRef(Date.now());

  const featuredChangelog = appUpdateInfo.featuredChangelog;
  const features = featuredChangelog?.features ?? [];
  const activeFeature: IFeaturedItem | undefined = features[activeIndex];

  const isForceUpdate = appUpdateInfo
    ? isForceUpdateStrategy(appUpdateInfo.updateStrategy)
    : isForceUpdateParam;

  // Prevent back navigation for force updates
  usePreventRemove(!!isForceUpdate && !!isPreInstall, () => {});

  // Log duration on unmount
  useEffect(() => {
    const mountTime = mountTimeRef.current;
    return () => {
      defaultLogger.app.appUpdate.whatsNewClosed({
        durationMs: Date.now() - mountTime,
      });
    };
  }, []);

  // Refresh update status on close (post-install only)
  const handleClose = useCallback(() => {
    if (!isPreInstall) {
      setTimeout(() => {
        void backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
      }, 250);
    }
  }, [isPreInstall]);

  // CTA handler: pre-install → download flow, post-install → deep link
  const handleCtaPress = useCallback(() => {
    if (isPreInstall) {
      // Navigate to download/verify (same as UpdatePreviewActionButton logic)
      navigation.push(EAppUpdateRoutes.DownloadVerify);
    } else {
      // Close modal and navigate to feature deep link
      navigation.pop();
      if (activeFeature?.ctaDeeplink) {
        // Use the app's deep link handler
        void backgroundApiProxy.serviceApp?.openDeepLink?.(
          activeFeature.ctaDeeplink,
        );
      }
    }
  }, [isPreInstall, navigation, activeFeature]);

  const versionDisplay = isPreInstall
    ? displayAppUpdateVersion(appUpdateInfo)
    : displayWhatsNewVersion();

  const ctaText = isPreInstall
    ? intl.formatMessage({ id: ETranslations.action_update })
    : activeFeature?.ctaText ?? intl.formatMessage({ id: ETranslations.global_done });

  if (!activeFeature) {
    return null;
  }

  return (
    <Page onClose={handleClose}>
      {/* No Page.Header — custom layout in body */}
      <Page.Body>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ px: '$5', pt: '$5', pb: '$2' }}
        >
          {/* NEW badge */}
          <Badge badgeType="success" badgeSize="sm" mb="$2.5">
            <Badge.Text>NEW</Badge.Text>
          </Badge>

          {/* Fixed title */}
          <SizableText size="$headingXl" mb="$1">
            {intl.formatMessage(
              { id: ETranslations.update_changelog_title },
              { ver: versionDisplay },
            )}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued" mb="$4">
            {intl.formatMessage({
              id: ETranslations.update_featured_subtitle,
            })}
          </SizableText>

          {/* Tab bar (hidden when single feature) */}
          <FeaturedTabBar
            features={features}
            activeIndex={activeIndex}
            onTabPress={setActiveIndex}
          />

          {/* Media area */}
          <FeaturedMedia feature={activeFeature} />

          {/* Feature title + description */}
          <SizableText size="$headingMd" mb="$1">
            {activeFeature.title}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {activeFeature.description}
          </SizableText>
        </ScrollView>
      </Page.Body>

      {/* Footer: CTA + changelog link */}
      <FeaturedFooter
        ctaText={ctaText}
        onCtaPress={handleCtaPress}
        isForceUpdate={isForceUpdate}
      />
    </Page>
  );
}

export default FeaturedChangelog;
```

- [ ] **Step 2: Verify the component renders**

Run the dev server and manually test by navigating to the FeaturedChangelog route with mock data in the atom.

```bash
yarn app:web
```

- [ ] **Step 3: Commit**

```bash
git add packages/kit/src/views/AppUpdate/pages/FeaturedChangelog.tsx
git commit -m "feat(appUpdate): add FeaturedChangelog page component (OK-52369)"
```

---

## Task 7: Service Layer — Parse Featured Config from API

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceAppUpdate.ts`

The existing `fetchAppUpdateInfo` method calls `/utility/v1/app-update` and stores the response in `appUpdatePersistAtom`. We extend it to parse `featuredChangelog` from the response.

- [ ] **Step 1: Extend the API response parsing**

In `packages/kit-bg/src/services/ServiceAppUpdate.ts`, locate the `fetchAppUpdateInfo` method (line ~968). Inside the response handling, after extracting existing fields, add:

```typescript
// After existing response parsing, add:
const featuredChangelog = responseData?.featuredChangelog;

// When building the IAppUpdateInfo object to store:
// Add `featuredChangelog` to the object spread
```

The exact location depends on how the method structures the response. Find where `appUpdatePersistAtom` is updated (look for `set(appUpdatePersistAtom, ...)` or similar), and include `featuredChangelog` in the stored object.

- [ ] **Step 2: Commit**

```bash
git add packages/kit-bg/src/services/ServiceAppUpdate.ts
git commit -m "feat(appUpdate): parse featuredChangelog from API response (OK-52369)"
```

---

## Task 8: Trigger Logic — Route to FeaturedChangelog

**Files:**
- Modify: `packages/kit/src/components/UpdateReminder/hooks.tsx`

This is the core behavioral change. Two trigger points need modification:

1. **Post-install trigger** (line ~886): `onViewReleaseInfo()` currently routes to WhatsNew
2. **Pre-install trigger** (line ~695): `toUpdatePreviewPage()` currently routes to UpdatePreview

- [ ] **Step 1: Modify onViewReleaseInfo to check featured config**

In `packages/kit/src/components/UpdateReminder/hooks.tsx`, modify the `onViewReleaseInfo` callback (lines 681-693):

```typescript
const onViewReleaseInfo = useCallback(() => {
  if (platformEnv.isE2E) {
    return;
  }
  setTimeout(async () => {
    // Check for featured changelog config
    const currentInfo =
      await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
    const pushModal = isFullModal
      ? navigation.pushFullModal
      : navigation.pushModal;

    if (hasFeaturedChangelog(currentInfo.featuredChangelog)) {
      pushModal(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.FeaturedChangelog,
        params: { isPreInstall: false },
      });
    } else {
      pushModal(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.WhatsNew,
      });
    }
  });
}, [isFullModal, navigation.pushFullModal, navigation.pushModal]);
```

Add the import at the top of the file:

```typescript
import { hasFeaturedChangelog } from '@onekeyhq/shared/src/appUpdate';
```

- [ ] **Step 2: Modify toUpdatePreviewPage to check featured config**

Modify `toUpdatePreviewPage` (lines 695-728) to route to FeaturedChangelog when config exists:

```typescript
const toUpdatePreviewPage = useCallback(
  (
    isFull = false,
    params?: {
      latestVersion?: string;
      isForceUpdate?: boolean;
    },
  ) => {
    setTimeout(async () => {
      const currentAppUpdateInfo =
        await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      const pushModal = isFull
        ? navigation.pushFullModal
        : navigation.pushModal;

      if (hasFeaturedChangelog(currentAppUpdateInfo.featuredChangelog)) {
        pushModal(EModalRoutes.AppUpdateModal, {
          screen: EAppUpdateRoutes.FeaturedChangelog,
          params: {
            isPreInstall: true,
            latestVersion:
              params?.latestVersion ?? currentAppUpdateInfo.latestVersion,
            isForceUpdate:
              params?.isForceUpdate ??
              isForceUpdateStrategy(appUpdateInfo.updateStrategy),
          },
        });
      } else {
        pushModal(EModalRoutes.AppUpdateModal, {
          screen: EAppUpdateRoutes.UpdatePreview,
          params: {
            latestVersion:
              params?.latestVersion ?? currentAppUpdateInfo.latestVersion,
            isForceUpdate:
              params?.isForceUpdate ??
              isForceUpdateStrategy(appUpdateInfo.updateStrategy),
            autoClose: isFull,
            ...params,
          },
        });
      }
    }, 0);
  },
  [
    appUpdateInfo.updateStrategy,
    navigation.pushFullModal,
    navigation.pushModal,
  ],
);
```

- [ ] **Step 3: Run lint and type-check**

```bash
yarn lint:staged
yarn tsc:staged
```

- [ ] **Step 4: Commit**

```bash
git add packages/kit/src/components/UpdateReminder/hooks.tsx
git commit -m "feat(appUpdate): route to FeaturedChangelog when config exists (OK-52369)"
```

---

## Task 9: i18n Keys

**Files:**
- Lokalise (external)

The following translation keys are needed. Create them on **Lokalise first**, then pull:

| Key | English | Chinese |
|-----|---------|---------|
| `update_featured_subtitle` | "Highlights from this update" | "本次更新的亮点功能" |
| `update_view_full_changelog` | "View full changelog" | "查看完整更新日志" |

- [ ] **Step 1: Create keys on Lokalise**

Create the keys above in the Lokalise project with English and Chinese translations.

- [ ] **Step 2: Pull translations**

```bash
yarn fetch:locale
```

- [ ] **Step 3: Commit locale files**

```bash
git add packages/shared/src/locale/
git commit -m "chore(i18n): add featured changelog translation keys (OK-52369)"
```

> **Dev workaround:** Until Lokalise keys are ready, use `intl.formatMessage` with a `defaultMessage` fallback to avoid build errors.

---

## Task 10: Integration Testing & Polish

- [ ] **Step 1: Test with mock data**

To test locally before the backend is ready, temporarily set mock featured changelog data in the atom. In a dev-only file or directly in `hooks.tsx` behind a `__DEV__` guard:

```typescript
if (__DEV__) {
  // Inject mock featured changelog for testing
  const mockFeatured: IFeaturedChangelog = {
    version: '6.1.0',
    features: [
      {
        tabLabel: '⚡ 0 手续费',
        title: 'Perps 交易，0 手续费',
        description: '所有合约订单享受零费率交易体验。',
        mediaUrl: 'https://placehold.co/600x338/1e1b4b/a5b4fc?text=Perps+0+Fee',
        mediaType: 'image',
        ctaText: '立即体验',
        ctaDeeplink: 'onekey-wallet://market_detail',
      },
      {
        tabLabel: '🔑 Keyless',
        title: 'Keyless 钱包，无需助记词',
        description: '用 iCloud / Google 账号直接创建钱包。',
        mediaUrl: 'https://placehold.co/600x338/0f3460/7dd3fc?text=Keyless',
        mediaType: 'image',
        ctaText: '创建 Keyless 钱包',
        ctaDeeplink: 'onekey-wallet://url_account',
      },
    ],
  };
}
```

- [ ] **Step 2: Verify all states**

Test each state manually:

| State | How to test | Expected |
|-------|-------------|----------|
| Multi-feature (2-3 tabs) | Mock 2-3 features | Tab bar visible, switching works |
| Single feature | Mock 1 feature | Tab bar hidden, media area slightly taller |
| No config | Remove mock / set empty features | Falls back to existing WhatsNew |
| Pre-install context | Set `isPreInstall: true` in route params | CTA = "Update" |
| Post-install context | Set `isPreInstall: false` | CTA = feature ctaText |
| Video media | Set `mediaType: 'video'` with video URL | Autoplay, muted, loop |
| Media load failure | Set invalid `mediaUrl` | Skeleton placeholder, no crash |
| Force update | Set `isForceUpdate: true` + `isPreInstall: true` | Cannot dismiss with back gesture |

- [ ] **Step 3: Test across platforms**

```bash
yarn app:web       # Desktop / Web
yarn app:ext       # Extension
yarn app:ios       # iOS (if available)
yarn app:android   # Android (if available)
```

Verify:
- Footer layout: large screen = link left + CTA right; small screen = CTA top + link below
- Media renders correctly on each platform
- Modal dismiss (tap overlay, back gesture) works

- [ ] **Step 4: Run full checks**

```bash
yarn lint:staged
yarn tsc:staged
yarn test
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(appUpdate): featured changelog integration complete (OK-52369)"
```

---

## Implementation Notes

**Deep link handler:** The `handleCtaPress` in `FeaturedChangelog.tsx` calls a deep link handler to navigate to the feature. Verify the exact method name in `ServiceApp` — it may be `openUrl`, `handleDeepLink`, or a custom method. Search the codebase for the deep link handling pattern used elsewhere.

**Video component ref:** The `Video` component from `@onekeyhq/components` wraps `react-native-video` on native and HTML5 `<video>` on web. The `ref` API may differ — test the `seek(0)` call on both platforms. If it doesn't work, unmount/remount the Video component by using `key={activeIndex}` on the `FeaturedMedia` component instead.

**Page.Footer children:** The custom footer layout uses `children` prop of `Page.Footer`. Verify that `Page.Footer` passes `children` through correctly — from the code analysis, when `children` is provided, `FooterActions` is not rendered, giving us full layout control. If this doesn't work as expected, fall back to placing the footer content inside `Page.Body` with absolute positioning.

**Badge component:** Verify `Badge` supports `badgeType="success"` for green styling. If the exact API differs, check `/packages/components/src/content/Badge/index.tsx` for the correct prop names.
