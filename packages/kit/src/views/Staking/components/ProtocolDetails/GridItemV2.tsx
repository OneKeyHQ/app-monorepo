import { useCallback, useMemo } from 'react';

import { StyleSheet } from 'react-native';

import type { IIconButtonProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Alert,
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
} from '@onekeyhq/components';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnActionIcon,
  IEarnHistoryActionIcon,
  IEarnIcon,
  IEarnPopupActionIcon,
  IEarnRebateTooltip,
  IEarnText,
  IEarnToken,
  IEarnTooltip,
} from '@onekeyhq/shared/types/staking';

import { useShareEvents } from '../../pages/ProtocolDetailsV2/ShareEventsProvider';

function PopupItemLine({
  icon,
  title,
  value,
  token,
}: {
  icon?: IEarnIcon;
  token?: IEarnToken;
  title: IEarnText;
  value: string;
}) {
  return (
    <XStack gap="$2" alignItems="center" justifyContent="space-between">
      <XStack gap="$2" alignItems="center">
        {icon ? <Icon name={icon.icon} size="$5" color={icon.color} /> : null}
        {token ? <Token tokenImageUri={token.logoURI ?? ''} size="xs" /> : null}
        <SizableText color={title.color || '$textSubdued'} size="$bodyMd">
          {title.text}
        </SizableText>
      </XStack>
      <SizableText size="$bodyMdMedium">{value}</SizableText>
    </XStack>
  );
}

export function ActionPopupContent({
  bulletList,
  items,
  panel,
}: {
  bulletList: IEarnPopupActionIcon['data']['bulletList'];
  items: IEarnPopupActionIcon['data']['items'];
  panel: IEarnPopupActionIcon['data']['panel'];
}) {
  return (
    <YStack p="$5">
      {items?.length ? (
        <YStack gap="$2.5">
          {items.map(({ icon, title, value, token }) => (
            <PopupItemLine
              key={title.text}
              icon={icon}
              token={token}
              title={title}
              value={value}
            />
          ))}
        </YStack>
      ) : null}
      {bulletList?.length ? (
        <YStack pt="$1.5" gap="$2">
          {bulletList.map((text, index) => (
            <XStack key={index} gap="$2" ai="center">
              <XStack
                h="$1"
                w="$1"
                my="$1.5"
                mx="$2"
                borderRadius="$full"
                bg="$iconSubdued"
              />
              <SizableText size="$bodySm" color={text.color || '$textSubdued'}>
                {text.text}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      ) : null}
      {panel?.length ? (
        <XStack
          mt="$4"
          py="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderRadius="$2"
          justifyContent="space-between"
          width="100%"
        >
          {panel.map((item, index) => (
            <YStack
              key={index}
              flex={1}
              alignItems="center"
              justifyContent="space-between"
            >
              <SizableText
                color={item.title.color || '$textSubdued'}
                size="$bodySm"
              >
                {item.title.text}
              </SizableText>
              <SizableText
                color={item.description?.color || '$text'}
                size="$bodyMdMedium"
              >
                {item.description?.text || '-'}
              </SizableText>
            </YStack>
          ))}
        </XStack>
      ) : null}
    </YStack>
  );
}

function RewardAmountPopoverContent({
  tooltip,
  onHistory,
}: {
  tooltip?: IEarnRebateTooltip;
  onHistory?: (params?: { filterType?: string }) => void;
}) {
  const { closePopover } = usePopoverContext();
  const handleHistoryPress = useCallback(async () => {
    await closePopover?.();
    setTimeout(() => {
      onHistory?.({ filterType: 'rebate' });
    }, 50);
  }, [closePopover, onHistory]);
  return (
    <YStack p="$5">
      <XStack>
        <SizableText size="$bodyLgMedium" color={tooltip?.data.title.color}>
          {tooltip?.data.description.text}
        </SizableText>
      </XStack>
      <XStack pt="$2">
        <SizableText
          size="$bodySm"
          color={tooltip?.data.text.color || '$textSubdued'}
        >
          {tooltip?.data.text.text}
        </SizableText>
      </XStack>
      {tooltip?.data.items.map((item, index) => {
        const button = item.button as IEarnHistoryActionIcon;
        const isHistoryButton = button?.type === 'history' && !button?.disabled;
        return (
          <XStack
            key={index}
            jc="space-between"
            pt="$4"
            onPress={isHistoryButton ? handleHistoryPress : undefined}
          >
            <FormatHyperlinkText
              size="$bodyMdMedium"
              color={item?.title?.color}
            >
              {item?.title?.text}
            </FormatHyperlinkText>
            {isHistoryButton ? (
              <XStack gap="$0.5" cursor="pointer">
                <SizableText size="$bodyMd" color="$textSubdued">
                  {button?.text.text}
                </SizableText>
                <Icon
                  name="ChevronRightSmallOutline"
                  color="$iconSubdued"
                  size="$5"
                />
              </XStack>
            ) : null}
          </XStack>
        );
      })}
    </YStack>
  );
}

export function GridItem({
  title,
  description,
  actionIcon,
  tooltip,
  type = 'default',
}: {
  title: IEarnText;
  description?: IEarnText;
  tooltip?: IEarnTooltip;
  actionIcon?: IEarnActionIcon;
  type?: 'default' | 'info' | 'alert';
}) {
  const { onHistory } = useShareEvents();
  const actionIconButton = useMemo(() => {
    let onPress: undefined | IIconButtonProps['onPress'];
    let icon: IKeyOfIcons | undefined;
    switch (actionIcon?.type) {
      case 'link':
        icon = 'OpenOutline';
        onPress = () => openUrlExternal(actionIcon.data.link);
        break;
      case 'popup':
        return actionIcon.data.icon ? (
          <Popover
            floatingPanelProps={{
              w: 320,
            }}
            title={title.text}
            renderTrigger={
              <IconButton
                icon={actionIcon.data.icon.icon}
                size="small"
                variant="tertiary"
              />
            }
            renderContent={
              <ActionPopupContent
                bulletList={actionIcon.data.bulletList}
                items={actionIcon.data.items}
                panel={actionIcon.data.panel}
              />
            }
            placement="top"
          />
        ) : null;
      default:
    }
    return icon ? (
      <IconButton
        size="small"
        icon={icon}
        onPress={onPress}
        color="$iconSubdued"
        variant="tertiary"
      />
    ) : null;
  }, [actionIcon, title.text]);

  const tooltipElement = useMemo(() => {
    if (tooltip) {
      switch (tooltip.type) {
        case 'rebate':
          return (
            <Popover
              placement="top"
              title={title.text}
              renderTrigger={
                <IconButton
                  iconColor="$iconSubdued"
                  size="small"
                  icon="InfoCircleOutline"
                  variant="tertiary"
                />
              }
              renderContent={
                <RewardAmountPopoverContent
                  tooltip={tooltip}
                  onHistory={onHistory}
                />
              }
            />
          );
        case 'text':
        default:
          return (
            <Popover
              placement="top"
              title={title.text}
              renderTrigger={
                <IconButton
                  iconColor="$iconSubdued"
                  size="small"
                  icon="InfoCircleOutline"
                  variant="tertiary"
                />
              }
              renderContent={
                <Stack p="$5">
                  <SizableText color={tooltip.data.color}>
                    {tooltip.data.text}
                  </SizableText>
                </Stack>
              }
            />
          );
      }
    }
    return null;
  }, [onHistory, title.text, tooltip]);

  if (type === 'info') {
    return (
      <Alert
        m="$3"
        flex={1}
        title={title.text}
        description={description?.text}
      />
    );
  }

  if (type === 'alert') {
    return (
      <Alert
        type="critical"
        m="$3"
        flex={1}
        title={title.text}
        description={description?.text}
      />
    );
  }
  return (
    <YStack
      p="$3"
      flexBasis="50%"
      $gtMd={{
        flexBasis: '33.33%',
      }}
    >
      <XStack gap="$1" mb="$1">
        <SizableText size="$bodyMd" color={title.color || '$textSubdued'}>
          {title.text}
        </SizableText>
        {tooltipElement}
      </XStack>
      <XStack gap="$1" alignItems="center">
        {description ? (
          <FormatHyperlinkText size="$bodyLgMedium" color={description.color}>
            {description.text}
          </FormatHyperlinkText>
        ) : null}
        {actionIconButton}
      </XStack>
    </YStack>
  );
}
