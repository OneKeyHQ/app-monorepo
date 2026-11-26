import { useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  ListView,
  Page,
  ScrollView,
  Skeleton,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { DelayedRender } from '@onekeyhq/components/src/hocs/DelayedRender';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { DeviceCommonHeader } from '../DeviceCommonHeader';
import { FadeView } from '../FadeView';
import { getDevicePageEndPadding } from '../listItemGroupLayout';

import SectionHeader from './SectionHeader';

// The device list's frame and loading state, kept out of the page so the
// router can show them while the page's code loads. The page renders through
// the same frame, so the hand-over is seamless.

// Desktop cards share three columns of the 900px page; anything narrower,
// phones included, two, so a wide window never stretches a lone card. React
// Native drops calc(), so its list lays the two columns out itself.
const DEVICE_GRID_MAX_WIDTH = 900;
const DEVICE_GRID_COLUMN_GAP = 16;
export const CARD_WIDTH = {
  mobile: platformEnv.isNative
    ? '100%'
    : `calc((100% - ${DEVICE_GRID_COLUMN_GAP}px) / 2)`,
  desktop: platformEnv.isNative
    ? '100%'
    : `calc((100% - ${DEVICE_GRID_COLUMN_GAP * 2}px) / 3)`,
} as const;
// The picture area is a fixed size, so a status change never moves a card.
export const ART_AREA_HEIGHT = { desktop: 244, mobile: 184 };
export const ART_HEIGHT = { desktop: 160, mobile: 120 };
// Phones read the cards' text a size up, as every other native list does.
export const CARD_TEXT = platformEnv.isNative
  ? ({ name: '$bodyLgMedium', detail: '$bodyMd', detailHeight: 20 } as const)
  : ({ name: '$bodyMdMedium', detail: '$bodySm', detailHeight: 16 } as const);
export const SURFACE_BG = {
  idle: '$bgSubdued',
  hover: '$bgHover',
  press: '$bgActive',
} as const;

// A quick load goes straight to the cards; only a wait long enough to
// notice brings in the placeholder. The router's placeholder is the
// exception: it only appears while the page's code loads, a wait there is
// no avoiding, so it shows at once and the page carries it on.
const PLACEHOLDER_DELAY_MS = 300;
let routePlaceholderShown = false;

// The page continues the router's placeholder, if there was one.
export function useDeviceListPlaceholderDelay() {
  const [delay] = useState(() => {
    const continuing = routePlaceholderShown;
    routePlaceholderShown = false;
    return continuing ? 0 : PLACEHOLDER_DELAY_MS;
  });
  return delay;
}

export function DeviceListPageBody({ children }: { children: ReactNode }) {
  return (
    <Page.Body
      alignItems="stretch"
      $gtMd={{
        overflow: 'hidden',
        borderTopLeftRadius: '$4',
        borderTopRightRadius: '$4',
      }}
    >
      {children}
    </Page.Body>
  );
}

// The title over a wrapping grid of cards.
export function DeviceListGrid({
  children,
  onAdd,
}: {
  children: ReactNode;
  onAdd?: () => void;
}) {
  return (
    <Page.Container flex={1} padded={false}>
      <ScrollView flex={1} bg="$bgApp">
        <YStack
          px="$pagePadding"
          pt="$2"
          pb="$8"
          $gtMd={{
            pt: platformEnv.isExtensionUiSidePanel ? '$2' : '$16',
            pb: '$16',
          }}
        >
          <YStack
            w="100%"
            maxWidth={DEVICE_GRID_MAX_WIDTH}
            alignSelf="center"
            gap="$6"
          >
            <SectionHeader onAdd={onAdd} />
            <XStack
              flexWrap="wrap"
              columnGap={DEVICE_GRID_COLUMN_GAP}
              rowGap="$6"
            >
              {children}
            </XStack>
          </YStack>
        </YStack>
      </ScrollView>
    </Page.Container>
  );
}

// The same cards on native, two per row: a list that only mounts the cards
// near the screen, since each one builds its own device drawing. The columns
// and their spacing match the grid's, and adding a device is the last cell.
const NATIVE_CARD_ESTIMATED_HEIGHT = 300;
const ADD_CELL = '__add_device__';

function isAddCell(cell: unknown): cell is typeof ADD_CELL {
  return cell === ADD_CELL;
}

export function DeviceListNative<T>({
  data,
  keyExtractor,
  renderCard,
  footer,
}: {
  data: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => ReactElement;
  footer: ReactElement;
}) {
  const { bottom } = useSafeAreaInsets();
  const cells: Array<T | typeof ADD_CELL> = [...data, ADD_CELL];
  return (
    <Page.Container flex={1} padded={false}>
      <ListView
        flex={1}
        bg="$bgApp"
        numColumns={2}
        data={cells}
        keyExtractor={(cell) =>
          isAddCell(cell) ? ADD_CELL : keyExtractor(cell)
        }
        estimatedItemSize={NATIVE_CARD_ESTIMATED_HEIGHT}
        contentContainerStyle={{
          px: '$pagePadding',
          pt: '$2',
          pb: getDevicePageEndPadding(bottom),
        }}
        renderItem={({ item: cell, index }) => (
          // Each cell takes half the row; its inner padding is the gap. Rows
          // after the first keep their distance above, so the list's end is
          // only the end padding.
          <YStack
            w="100%"
            pt={index >= 2 ? '$6' : undefined}
            pl={index % 2 ? DEVICE_GRID_COLUMN_GAP / 2 : 0}
            pr={index % 2 ? 0 : DEVICE_GRID_COLUMN_GAP / 2}
          >
            {isAddCell(cell) ? footer : renderCard(cell)}
          </YStack>
        )}
      />
    </Page.Container>
  );
}

// Holds the first card's place while the devices load: the same surface,
// a device-shaped block where the art goes, and the two text lines.
function DeviceCardSkeleton({ fadeIn }: { fadeIn: boolean }) {
  const { gtMd } = useMedia();
  const size = gtMd ? 'desktop' : 'mobile';
  return (
    // Native lays its columns out in the list, so the placeholder takes the
    // first cell's half of the row itself.
    <YStack
      w={platformEnv.isNative ? '50%' : CARD_WIDTH.mobile}
      pr={platformEnv.isNative ? DEVICE_GRID_COLUMN_GAP / 2 : undefined}
      $gtMd={{ w: CARD_WIDTH.desktop }}
    >
      <FadeView fadeInOnMount={fadeIn}>
        <Stack
          h={ART_AREA_HEIGHT[size]}
          bg={SURFACE_BG.idle}
          borderRadius="$4"
          ai="center"
          jc="center"
        >
          <Skeleton
            w={Math.round(ART_HEIGHT[size] * 0.62)}
            h={ART_HEIGHT[size]}
            radius={16}
          />
        </Stack>
        <YStack p="$4" gap="$1">
          {platformEnv.isNative ? (
            <>
              <Skeleton.BodyLg w={88} />
              <Skeleton.BodyMd w={64} />
            </>
          ) : (
            <>
              <Skeleton.BodyMd w={88} />
              <Skeleton.BodySm w={64} />
            </>
          )}
        </YStack>
      </FadeView>
    </YStack>
  );
}

// Shown at once when it continues a placeholder already on screen; otherwise
// after the rest of the wait, fading in.
export function DeviceListPlaceholder({ delay }: { delay: number }) {
  if (delay <= 0) {
    return <DeviceCardSkeleton fadeIn={false} />;
  }
  return (
    <DelayedRender delay={delay}>
      <DeviceCardSkeleton fadeIn />
    </DelayedRender>
  );
}

function DeviceListLoadingPage() {
  const intl = useIntl();
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
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <Page fullPage safeAreaEnabled>
        <DeviceCommonHeader
          title={intl.formatMessage({
            id: ETranslations.global_device_management,
          })}
        />
        <DeviceListPageBody>
          <DeviceListGrid>
            <DeviceListPlaceholder delay={0} />
          </DeviceListGrid>
        </DeviceListPageBody>
      </Page>
    </AccountSelectorProviderMirror>
  );
}

// What the router shows while the page's code loads. Native keeps the plain
// spinner it had.
export function DeviceListRouteFallback() {
  if (platformEnv.isNative) {
    return (
      <Stack flex={1} alignItems="center" justifyContent="center">
        <Spinner size="large" />
      </Stack>
    );
  }
  return <DeviceListLoadingPage />;
}
