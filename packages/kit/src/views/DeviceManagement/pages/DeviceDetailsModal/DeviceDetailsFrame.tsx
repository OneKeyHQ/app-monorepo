import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Page,
  ScrollView,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/config/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalDeviceManagementRoutes,
  ETabDeviceManagementRoutes,
  IModalDeviceManagementParamList,
  ITabDeviceManagementParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { useDeviceManagerModalStyle } from '../../hooks/useDeviceManagerModalStyle';
import { DeviceCommonHeader } from '../DeviceCommonHeader';
import { FadeView } from '../FadeView';
import { ListItemGroup } from '../ListItemGroup';

import { DeviceHelpSidebar } from './DeviceHelpSidebar';

// The device details page's frame and loading state, kept out of the page so
// the router can show them while the page's code loads. The page renders
// through the same frame, so the hand-over is seamless.

// One settings column; rows bleed 12px past it on both sides.
const DEVICE_DETAILS_COLUMN_WIDTH = 640 + 12 * 2;

// A quick load goes straight to the content; only a wait long enough to
// notice brings in the placeholder. The router's placeholder is the
// exception: it only appears while the page's code loads, a wait there is
// no avoiding, so it shows at once and the page carries it on.
const PLACEHOLDER_DELAY_MS = 300;
let routePlaceholderShown = false;

// The page continues the router's placeholder, if there was one.
export function useDeviceDetailsPlaceholderDelay() {
  const [delay] = useState(() => {
    const continuing = routePlaceholderShown;
    routePlaceholderShown = false;
    return continuing ? 0 : PLACEHOLDER_DELAY_MS;
  });
  return delay;
}

// Help gets its own column only where there is room for it; elsewhere the
// troubleshooting row in the page stands in for it. Decided from what is
// known on arrival, so the layout does not switch under the content once
// the device loads: the device list passes the vendor with the route, and
// a vendor not known yet is OneKey's, as stored devices default.
export function useDeviceDetailsHelpSidebar({
  walletId,
  vendor,
}: {
  walletId: string;
  vendor: EHardwareVendor | undefined;
}) {
  const { gtXl } = useMedia();
  const { isModalStack } = useDeviceManagerModalStyle();
  return (
    gtXl &&
    !isModalStack &&
    !accountUtils.isQrWallet({ walletId }) &&
    getVendorProfile(vendor).deviceManager.settings
  );
}

export function getDeviceArtHeight(gtMd: boolean) {
  return gtMd ? 96 : 80;
}

// The header's shape while the device loads: art, name, status line.
export function DeviceBasicInfoSkeleton() {
  const { gtMd } = useMedia();
  const artHeight = getDeviceArtHeight(gtMd);
  return (
    <XStack ai="center" gap={gtMd ? '$5' : '$4'}>
      <Skeleton w={Math.round(artHeight * 0.62)} h={artHeight} radius={12} />
      <YStack gap="$2">
        <Skeleton w={200} h={gtMd ? 36 : 32} radius={8} />
        <Skeleton w={240} h="$5" radius={4} />
      </YStack>
    </XStack>
  );
}

// Text lines at the rows' own sizes (see listItemGroupLayout).
function SkeletonRows({ widths }: { widths: number[] }) {
  const RowTitle = platformEnv.isNative ? Skeleton.BodyLg : Skeleton.BodyMd;
  return (
    <ListItemGroup withSeparator>
      {widths.map((w) => (
        <XStack key={w} ai="center">
          <RowTitle w={w} />
        </XStack>
      ))}
    </ListItemGroup>
  );
}

// The column's shape while the device loads: the header, then grouped rows
// on the same cards the sections use.
function DeviceDetailsSkeleton({
  fadeIn,
  withTroubleshooting,
}: {
  fadeIn: boolean;
  withTroubleshooting: boolean;
}) {
  const GroupTitle = platformEnv.isNative
    ? Skeleton.HeadingLg
    : Skeleton.HeadingMd;
  return (
    <FadeView fadeInOnMount={fadeIn}>
      <YStack gap="$8">
        <DeviceBasicInfoSkeleton />
        {/* Support, which gains the troubleshooting row where help has no
            column of its own. */}
        <SkeletonRows
          widths={withTroubleshooting ? [112, 104, 128, 120] : [112, 104, 128]}
        />
        <YStack gap="$2.5">
          <GroupTitle w={72} />
          <SkeletonRows widths={[88, 96, 80, 104]} />
        </YStack>
      </YStack>
    </FadeView>
  );
}

// Shown at once when it continues a placeholder already on screen; otherwise
// after the rest of the wait, fading in.
export function DeviceDetailsPlaceholder({
  delay,
  withTroubleshooting,
}: {
  delay: number;
  withTroubleshooting: boolean;
}) {
  if (delay <= 0) {
    return (
      <DeviceDetailsSkeleton
        fadeIn={false}
        withTroubleshooting={withTroubleshooting}
      />
    );
  }
  return (
    <DelayedRender delay={delay}>
      <DeviceDetailsSkeleton fadeIn withTroubleshooting={withTroubleshooting} />
    </DelayedRender>
  );
}

export function DeviceDetailsPageFrame({
  showHelpSidebar,
  sidebar,
  testID,
  children,
}: {
  showHelpSidebar: boolean;
  sidebar: ReactNode;
  testID?: string;
  children: ReactNode;
}) {
  const intl = useIntl();
  const column = (
    <YStack
      flex={showHelpSidebar ? undefined : 1}
      minWidth={0}
      alignItems="center"
      px="$pagePadding"
      // Narrow layouts start right under the header; the device needs room
      // from it.
      pt="$6"
      pb="$8"
      $gtMd={{ px: '$6', pt: '$12', pb: '$16' }}
    >
      <YStack w="100%" maxWidth={DEVICE_DETAILS_COLUMN_WIDTH} gap="$8">
        {children}
      </YStack>
    </YStack>
  );
  return (
    // With help beside them, the settings and the help each scroll on their
    // own; otherwise the whole page scrolls. Native pages run to the bottom
    // edge; the column's bottom padding clears the home indicator.
    <Page
      scrollEnabled={!showHelpSidebar}
      safeAreaEnabled={!platformEnv.isNative}
    >
      <DeviceCommonHeader
        title={intl.formatMessage({ id: ETranslations.global_about_device })}
      />
      <Page.Body alignItems="stretch" pt="$0" pb="$0" testID={testID}>
        {showHelpSidebar ? (
          <XStack flex={1}>
            <ScrollView flex={1} minWidth={0}>
              {column}
            </ScrollView>
            {sidebar}
          </XStack>
        ) : (
          <XStack w="100%" alignItems="flex-start">
            {column}
          </XStack>
        )}
      </Page.Body>
    </Page>
  );
}

function DeviceDetailsLoadingPage() {
  const route = useAppRoute<
    IModalDeviceManagementParamList | ITabDeviceManagementParamList,
    | EModalDeviceManagementRoutes.DeviceDetailModal
    | ETabDeviceManagementRoutes.DeviceDetail
  >();
  const { walletId = '', initialDeviceVendor } =
    (route.params as
      | { walletId?: string; initialDeviceVendor?: EHardwareVendor }
      | undefined) ?? {};
  const showHelpSidebar = useDeviceDetailsHelpSidebar({
    walletId,
    vendor: initialDeviceVendor,
  });
  // Tells the page to carry this placeholder on. If the user leaves before
  // the page arrives, the note goes with it.
  useState(() => {
    routePlaceholderShown = true;
    return null;
  });
  useEffect(
    () => () => {
      routePlaceholderShown = false;
    },
    [],
  );
  return (
    <AccountSelectorProviderMirror
      config={{ sceneName: EAccountSelectorSceneName.home }}
      enabledNum={[0]}
    >
      <DeviceDetailsPageFrame
        showHelpSidebar={showHelpSidebar}
        sidebar={<DeviceHelpSidebar placeholder />}
      >
        <DeviceDetailsPlaceholder
          delay={0}
          withTroubleshooting={!showHelpSidebar}
        />
      </DeviceDetailsPageFrame>
    </AccountSelectorProviderMirror>
  );
}

// What the router shows while the page's code loads. Native keeps the plain
// spinner it had.
export function DeviceDetailsRouteFallback() {
  if (platformEnv.isNative) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </Stack>
    );
  }
  return <DeviceDetailsLoadingPage />;
}
