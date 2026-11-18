import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { parseNotificationPayload } from '@onekeyhq/shared/src/utils/notificationsUtils';
import type {
  ILinkConfigItem,
  ILinkConfigSlot,
} from '@onekeyhq/shared/types/linkConfig';

import { DeviceManagementTestIDs } from '../../testIDs';

// Rows bleed past the text edge so hover fills reach beyond the text.
const BLEED = 12;
const MAX_GUIDES = 3;

function openLink(item: ILinkConfigItem) {
  parseNotificationPayload(item.mode, item.payload, () => {});
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
} & Record<string, unknown>) {
  return (
    <XStack
      {...shell}
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
      py={8}
      borderRadius={8}
      gap="$3"
      userSelect="none"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineColor: '$focusRing',
        outlineOffset: -2,
      }}
    >
      {children}
    </XStack>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <XStack minHeight={32} px={BLEED} ai="center">
      <SizableText size="$bodyMdMedium" color="$textSubdued" flex={1}>
        {children}
      </SizableText>
    </XStack>
  );
}

function LinkRow({
  title,
  testID,
  onPress,
}: {
  title: string;
  testID?: string;
  onPress: () => void;
}) {
  return (
    <PressableRow
      onPress={onPress}
      testID={testID}
      minHeight={36}
      ai="flex-start"
    >
      <SizableText
        size="$bodyMd"
        flex={1}
        minWidth={0}
        numberOfLines={2}
        // No one-word last lines when a title wraps.
        style={{ textWrap: 'pretty' }}
      >
        {title}
      </SizableText>
      <Icon
        name="ChevronRightSmallOutline"
        size="$4"
        color="$iconDisabled"
        flexShrink={0}
        // Sits on the first text line when the title wraps.
        mt={2}
      />
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

// Questions configured on the server.
function FaqsSection() {
  const intl = useIntl();
  const faqs = useLinks('hardware_faqs');
  if (faqs && !faqs.length) return null;
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
            onPress={() => openLink(item)}
          />
        ))
      ) : (
        <RowsSkeleton widths={[220, 180, 200]} height={36} />
      )}
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
            bg="rgba(0, 0, 0, 0.55)"
            ai="center"
            jc="center"
            // Optical centering: a play triangle reads left-heavy.
            pl={1}
          >
            <Icon name="PlaySolid" size="$3" color="$whiteA12" />
          </Stack>
        </Stack>
      </Stack>
      <SizableText size="$bodyMd" flex={1} numberOfLines={2}>
        {item.title}
      </SizableText>
    </PressableRow>
  );
}

// Video guides configured on the server.
function GuidesSection() {
  const intl = useIntl();
  const guides = useLinks('hardware_getstarteds');
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
        <RowsSkeleton widths={[200, 170]} height={61} />
      )}
    </YStack>
  );
}

export function DeviceHelpPanel() {
  const intl = useIntl();
  return (
    <YStack gap="$5">
      <FaqsSection />
      <GuidesSection />
      <YStack gap="$2">
        <Stack px={BLEED}>
          <Stack h={1} bg="$neutral4" />
        </Stack>
        <LinkRow
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
