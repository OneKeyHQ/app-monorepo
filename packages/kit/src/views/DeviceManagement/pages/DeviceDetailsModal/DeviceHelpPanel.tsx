import { useCallback } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { PixelRatio } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useDeviceDetailsActions } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { showIntercom } from '@onekeyhq/kit/src/views/Intercom/client';
import { HELP_CENTER_HARDWARE_FAQ_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import { openUrlInDiscovery } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  ILinkConfigItem,
  ILinkConfigSlot,
} from '@onekeyhq/shared/types/linkConfig';

import { useDeviceManagerNavigation } from '../../hooks/useDeviceManagerNavigation';
import { DeviceManagementTestIDs } from '../../testIDs';

// Hover and press tint only the background, eased by CSS on the web; native
// switches it at once.
const BG_TRANSITION = platformEnv.isNative
  ? undefined
  : { transition: 'background-color 150ms ease-out' };

// Rows bleed past the text edge so hover fills reach beyond the text.
const BLEED = 12;
const MAX_GUIDES = 3;
// One device pixel, like the separators in the settings cards.
const HAIRLINE = 1 / PixelRatio.get();

function openLink(item: ILinkConfigItem) {
  parseNotificationPayload(item.mode, item.payload, () => {});
}

// Articles open in the app's browser, whatever open mode the server sets.
function openArticle(item: ILinkConfigItem) {
  const url = item.payload?.trim();
  if (url && /^https?:\/\//i.test(url)) {
    openUrlInDiscovery({ url, title: item.title });
    return;
  }
  openLink(item);
}

// The full hardware FAQ collection, in the app's browser as before.
function openAllFaqs() {
  openUrlInDiscovery({ url: HELP_CENTER_HARDWARE_FAQ_URL });
}

function useLinks(slot: ILinkConfigSlot) {
  const { result } = usePromiseResult<ILinkConfigItem[] | undefined>(
    async () => {
      try {
        const items =
          await backgroundApiProxy.serviceSetting.fetchGetStartedLinks({
            slots: [slot],
          });
        return items.filter((item) => item.title?.trim());
      } catch {
        return [];
      }
    },
    [slot],
    { initResult: undefined },
  );
  return result;
}

// One row, one control: hover, press, a focus ring, and Enter or Space from
// the keyboard.
function PressableRow({
  onPress,
  children,
  testID,
  ...shell
}: {
  onPress: () => void;
  children: ReactNode;
  testID?: string;
} & Omit<ComponentProps<typeof XStack>, 'onPress' | 'children'>) {
  const reducedMotion = useReducedMotion();
  return (
    <XStack
      role="button"
      tabIndex={0}
      testID={testID}
      onPress={onPress}
      onKeyDown={(e: { key: string; preventDefault: () => void }) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPress();
        }
      }}
      px={BLEED}
      py={10}
      borderRadius={8}
      gap="$3"
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      style={reducedMotion ? undefined : BG_TRANSITION}
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineColor: '$focusRing',
        outlineOffset: -2,
      }}
      {...shell}
    >
      {children}
    </XStack>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <XStack minHeight={32} px={BLEED} ai="center">
      <SizableText
        size="$headingSm"
        color="$text"
        flex={1}
        role="heading"
        aria-level={2}
      >
        {children}
      </SizableText>
    </XStack>
  );
}

function LinkRow({
  title,
  icon,
  testID,
  onPress,
}: {
  title: string;
  icon?: IKeyOfIcons;
  testID?: string;
  onPress: () => void;
}) {
  return (
    <PressableRow onPress={onPress} testID={testID} minHeight={40} ai="center">
      {icon ? (
        <Icon name={icon} size="$4" color="$iconSubdued" flexShrink={0} />
      ) : null}
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        flex={1}
        minWidth={0}
        numberOfLines={2}
        // No one-word last lines when a title wraps.
        style={{ textWrap: 'pretty' }}
      >
        {title}
      </SizableText>
    </PressableRow>
  );
}

function RowsSkeleton({
  widths,
  height,
}: {
  widths: number[];
  height: number;
}) {
  return (
    <YStack>
      {widths.map((w) => (
        <XStack key={w} h={height} px={BLEED} ai="center">
          <Skeleton.BodyMd w={w} />
        </XStack>
      ))}
    </YStack>
  );
}

// After the list, where someone who didn't find their question looks next.
// The chevron sets it apart from the articles.
function ViewAllFaqsRow() {
  const intl = useIntl();
  return (
    <PressableRow
      onPress={openAllFaqs}
      testID={DeviceManagementTestIDs.helpFaqViewMoreBtn}
      minHeight={40}
      ai="center"
      gap="$1"
    >
      <SizableText size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_view_more })}
      </SizableText>
      <Icon name="ChevronRightSmallOutline" size="$4" color="$iconSubdued" />
    </PressableRow>
  );
}

// Shaped like a guide row: the thumbnail where it will land and two lines
// where the title wraps, so nothing moves when the guides arrive.
function GuideRowsSkeleton() {
  return (
    <YStack>
      {[
        [190, 130],
        [204, 112],
        [214, 64],
      ].map(([first, second]) => (
        <XStack key={first} px={BLEED} py={10} gap="$3" ai="center">
          <Skeleton w={80} h={45} radius={6} />
          <YStack flex={1}>
            <Skeleton.BodyMd w={first} />
            <Skeleton.BodyMd w={second} />
          </YStack>
        </XStack>
      ))}
    </YStack>
  );
}

// Questions configured on the server. With none, or none loaded, the link
// to every question still stands.
function FaqsSection({ faqs }: { faqs: ILinkConfigItem[] | undefined }) {
  const intl = useIntl();
  return (
    <YStack>
      <SectionLabel>
        {intl.formatMessage({ id: ETranslations.global_faqs })}
      </SectionLabel>
      {faqs ? (
        faqs.map((item) => (
          <LinkRow
            key={item.linkId}
            title={item.title}
            testID={DeviceManagementTestIDs.helpFaqItem}
            onPress={() => openArticle(item)}
          />
        ))
      ) : (
        <RowsSkeleton widths={[220, 180, 200, 236, 196]} height={40} />
      )}
      {/* Needs no data, so it is there while the questions load and the
          section does not grow when they arrive. */}
      <ViewAllFaqsRow />
    </YStack>
  );
}

function GuideRow({ item }: { item: ILinkConfigItem }) {
  return (
    <PressableRow onPress={() => openLink(item)} ai="center">
      <Stack
        w={80}
        h={45}
        borderRadius={6}
        overflow="hidden"
        bg="$bgStrong"
        flexShrink={0}
      >
        {item.image ? (
          <Image
            source={{ uri: item.image }}
            w={80}
            h={45}
            resizeWidth={160}
            resizeMode="cover"
          />
        ) : null}
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          ai="center"
          jc="center"
          borderRadius={6}
          borderWidth={1}
          borderColor="$neutral4"
          pointerEvents="none"
        >
          <Stack
            w={20}
            h={20}
            borderRadius={10}
            bg="rgba(255, 255, 255, 0.92)"
            ai="center"
            jc="center"
            // Optical centering: a play triangle reads left-heavy.
            pl={1}
            style={{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)' }}
          >
            <Icon name="PlaySolid" size="$3" color="$blackA12" />
          </Stack>
        </Stack>
      </Stack>
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        flex={1}
        numberOfLines={2}
      >
        {item.title}
      </SizableText>
    </PressableRow>
  );
}

// Video guides configured on the server.
function GuidesSection({ guides }: { guides: ILinkConfigItem[] | undefined }) {
  const intl = useIntl();
  if (guides && !guides.length) return null;
  return (
    <YStack>
      <SectionLabel>
        {intl.formatMessage({ id: ETranslations.global_get_started })}
      </SectionLabel>
      {guides ? (
        guides
          .slice(0, MAX_GUIDES)
          .map((item) => <GuideRow key={item.linkId} item={item} />)
      ) : (
        <GuideRowsSkeleton />
      )}
    </YStack>
  );
}

// The router's placeholder has no device to troubleshoot yet; its row only
// holds the place.
function noop() {}

// The panel as drawn. Lists not given yet show as loading, which is also how
// the router draws it while the page's code loads.
export function DeviceHelpPanelView({
  faqs,
  guides,
  onPressTroubleshooting = noop,
}: {
  faqs?: ILinkConfigItem[];
  guides?: ILinkConfigItem[];
  onPressTroubleshooting?: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$5">
      <FaqsSection faqs={faqs} />
      <GuidesSection guides={guides} />
      {/* The actions, marked with icons: they open the troubleshooting guide
          and a chat, not articles. With this column beside the settings, the
          guide lives here instead of in the Support card. */}
      <YStack gap="$2">
        <Stack px={BLEED}>
          <Stack h={HAIRLINE} bg="$neutral4" />
        </Stack>
        <LinkRow
          icon="ToolboxOutline"
          title={intl.formatMessage({
            id: ETranslations.global_hardware_troubleshooting,
          })}
          testID={DeviceManagementTestIDs.troubleshootingItem}
          onPress={onPressTroubleshooting}
        />
        <LinkRow
          icon="HelpSupportOutline"
          title={intl.formatMessage({
            id: ETranslations.global_hardware_troubleshooting_contact,
          })}
          testID={DeviceManagementTestIDs.helpContactSupportBtn}
          onPress={() => void showIntercom()}
        />
      </YStack>
    </YStack>
  );
}

export function DeviceHelpPanel() {
  const faqs = useLinks('hardware_faqs');
  const guides = useLinks('hardware_getstarteds');
  const actions = useDeviceDetailsActions();
  const { pushToTroubleshooting } = useDeviceManagerNavigation();
  const onPressTroubleshooting = useCallback(async () => {
    const walletWithDevice = await actions.getWalletWithDevice();
    if (!walletWithDevice) return;
    pushToTroubleshooting({ walletWithDevice });
  }, [actions, pushToTroubleshooting]);
  return (
    <DeviceHelpPanelView
      faqs={faqs}
      guides={guides}
      onPressTroubleshooting={() => void onPressTroubleshooting()}
    />
  );
}
