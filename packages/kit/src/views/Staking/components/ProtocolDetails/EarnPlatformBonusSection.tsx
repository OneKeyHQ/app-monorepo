import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  Divider,
  Icon,
  Image,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EarnNavigation } from '@onekeyhq/kit/src/views/Earn/earnUtils';
import type {
  IEarnActionIcon,
  IEarnPlatformBonus,
  IEarnPopupActionIcon,
  IEarnText,
  IEarnTokenInfo,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { EarnIcon } from './EarnIcon';
import { EarnText } from './EarnText';

function getVisibleEarnText(text?: Partial<IEarnText>): IEarnText | undefined {
  if (!text?.text?.trim()) {
    return undefined;
  }
  return {
    ...text,
    text: text.text,
  };
}

function BonusRulesInfoRow({
  item,
}: {
  item: NonNullable<IEarnPopupActionIcon['data']['items']>[number];
}) {
  return (
    <XStack gap="$3" ai="center" jc="space-between">
      <XStack gap="$2" ai="center" flex={1} minWidth={0}>
        <EarnIcon icon={item.icon} size="$4" color="$iconSubdued" />
        {item.token?.info.logoURI ? (
          <Image src={item.token.info.logoURI} w="$4" h="$4" />
        ) : null}
        <EarnText
          text={item.title}
          size="$bodyMd"
          color={item.title.color ?? '$textSubdued'}
          flexShrink={1}
        />
      </XStack>
      <SizableText size="$bodyMdMedium" color="$text" textAlign="right">
        {item.value}
      </SizableText>
    </XStack>
  );
}

function EarnPlatformBonusDialogFooter({
  actionIcon,
  onClose,
  protocolInfo,
  tokenInfo,
}: {
  actionIcon?: IEarnActionIcon;
  onClose: () => Promise<void> | void;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
}) {
  const navigation = useAppNavigation();

  if (!actionIcon) {
    return null;
  }

  const actionText = getVisibleEarnText(actionIcon.text);
  if (!actionText) {
    return null;
  }

  if (actionIcon.type === 'close') {
    return (
      <Button
        testID="earn-platform-bonus-rules-close"
        variant="primary"
        w="100%"
        disabled={actionIcon.disabled}
        onPress={() => {
          void onClose();
        }}
      >
        {actionText.text}
      </Button>
    );
  }

  if (actionIcon.type === 'portfolio') {
    const networkId = protocolInfo?.networkId ?? tokenInfo?.networkId;
    const symbol = protocolInfo?.symbol ?? tokenInfo?.token.symbol;
    const provider = protocolInfo?.provider ?? tokenInfo?.provider;
    const vault = protocolInfo?.vault ?? tokenInfo?.vault;
    const isDisabled =
      actionIcon.disabled || !networkId || !symbol || !provider;

    return (
      <Button
        testID="earn-platform-bonus-rules-portfolio"
        variant="primary"
        w="100%"
        disabled={isDisabled}
        onPress={() => {
          void Promise.resolve(onClose()).then(() =>
            EarnNavigation.pushToEarnProtocolDetails(navigation, {
              networkId: networkId ?? '',
              symbol: symbol ?? '',
              provider: provider ?? '',
              vault,
            }),
          );
        }}
      >
        {actionText.text}
      </Button>
    );
  }

  return null;
}

function EarnPlatformBonusRulesDialogContent({
  data,
  onClose,
  protocolInfo,
  tokenInfo,
}: {
  data: IEarnPopupActionIcon['data'];
  onClose: () => Promise<void> | void;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
}) {
  const platformBonusInfos = data.platformBonusInfos?.filter(
    (item) =>
      getVisibleEarnText(item.title) || getVisibleEarnText(item.description),
  );

  return (
    <YStack gap="$5">
      {data.items?.length ? (
        <YStack gap="$2.5">
          {data.items.map((item, index) => (
            <BonusRulesInfoRow
              key={`${item.title.text || 'item'}-${index}`}
              item={item}
            />
          ))}
        </YStack>
      ) : null}
      {platformBonusInfos?.length ? (
        <YStack gap="$4">
          {data.items?.length ? <Divider /> : null}
          {platformBonusInfos.map((item, index) => (
            <YStack key={`${item.title.text || 'info'}-${index}`} gap="$2">
              {getVisibleEarnText(item.title) ? (
                <EarnText
                  text={item.title}
                  size="$bodyMdMedium"
                  color={item.title.color ?? '$text'}
                />
              ) : null}
              {getVisibleEarnText(item.description) ? (
                <EarnText
                  text={item.description}
                  size="$bodyMd"
                  color={item.description.color ?? '$textSubdued'}
                />
              ) : null}
            </YStack>
          ))}
        </YStack>
      ) : null}
      <EarnPlatformBonusDialogFooter
        actionIcon={data.button}
        onClose={onClose}
        protocolInfo={protocolInfo}
        tokenInfo={tokenInfo}
      />
    </YStack>
  );
}

export function EarnPlatformBonusSection({
  platformBonus,
  footer,
  protocolInfo,
  tokenInfo,
}: {
  platformBonus?: IEarnPlatformBonus;
  footer?: ReactNode;
  protocolInfo?: IProtocolInfo;
  tokenInfo?: IEarnTokenInfo;
}) {
  const media = useMedia();
  const dialogData = platformBonus?.button?.data;
  const rulesButtonText =
    getVisibleEarnText(platformBonus?.button?.text) ??
    getVisibleEarnText(dialogData?.title);
  const hasRulesButton = Boolean(rulesButtonText?.text && dialogData);
  const summary = platformBonus?.summary.filter((item) =>
    getVisibleEarnText(item),
  );
  const shouldInlineRulesButton = Boolean(media.gtSm && hasRulesButton);

  const showRulesDialog = useCallback(() => {
    if (!dialogData) {
      return;
    }

    const dialogRef: {
      close?: () => Promise<void> | void;
    } = {};
    const dialog = Dialog.show({
      title: dialogData.title?.text,
      showFooter: false,
      floatingPanelProps: {
        w: 400,
      },
      renderContent: (
        <EarnPlatformBonusRulesDialogContent
          data={dialogData}
          onClose={() => dialogRef.close?.()}
          protocolInfo={protocolInfo}
          tokenInfo={tokenInfo}
        />
      ),
    });
    dialogRef.close = dialog.close;
  }, [dialogData, protocolInfo, tokenInfo]);

  if (!platformBonus) {
    return null;
  }

  let rulesButton: ReactNode = null;
  if (hasRulesButton) {
    if (media.gtSm) {
      rulesButton = (
        <XStack
          gap="$1"
          ai="center"
          flexShrink={0}
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
          onPress={showRulesDialog}
        >
          <EarnText
            text={rulesButtonText}
            size="$bodyMdMedium"
            color={rulesButtonText?.color ?? '$textSubdued'}
          />
          <Icon
            name="ChevronRightSmallOutline"
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
      );
    } else {
      rulesButton = (
        <Button
          testID="earn-platform-bonus-view-rules"
          variant="secondary"
          w="100%"
          onPress={showRulesDialog}
        >
          {rulesButtonText?.text}
        </Button>
      );
    }
  }

  const summaryItems = summary ?? [];
  const summaryLeadItems = shouldInlineRulesButton
    ? summaryItems.slice(0, Math.max(summaryItems.length - 1, 0))
    : summaryItems;
  const summaryInlineItem = shouldInlineRulesButton
    ? summaryItems[summaryItems.length - 1]
    : undefined;

  const summaryContent =
    summaryLeadItems.length || summaryInlineItem || rulesButton ? (
      <YStack gap="$1.5">
        {summaryLeadItems.map((item, index) => (
          <EarnText
            key={`${item.text}-${index}`}
            text={item}
            size="$bodyMd"
            color={item.color ?? '$text'}
          />
        ))}
        {shouldInlineRulesButton ? (
          <XStack gap="$3" ai="center" jc="space-between">
            {summaryInlineItem ? (
              <EarnText
                text={summaryInlineItem}
                size="$bodyMd"
                color={summaryInlineItem.color ?? '$text'}
                flex={1}
              />
            ) : (
              <XStack flex={1} />
            )}
            {rulesButton}
          </XStack>
        ) : (
          rulesButton
        )}
      </YStack>
    ) : null;

  return (
    <YStack
      p="$3.5"
      gap="$4"
      borderRadius="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
    >
      <XStack gap="$2" ai="center" flexWrap="wrap">
        <XStack gap="$1.5" ai="center">
          <EarnIcon icon={platformBonus.icon} size="$4" color="$iconSuccess" />
          <EarnText
            text={platformBonus.title}
            size="$bodyMdMedium"
            color={platformBonus.title.color ?? '$text'}
          />
        </XStack>
        <Divider vertical h="$4" />
        <EarnText
          text={platformBonus.period}
          size="$bodyMd"
          color={platformBonus.period.color ?? '$textSubdued'}
        />
      </XStack>

      {summaryContent}

      {footer ? (
        <>
          <Divider />
          {footer}
        </>
      ) : null}
    </YStack>
  );
}
