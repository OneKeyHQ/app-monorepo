import { useCallback, useMemo } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';

import { StyleSheet } from 'react-native';

import type { IIconButtonProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnActionIcon,
  IEarnIcon,
  IEarnPopupActionIcon,
  IEarnText,
  IEarnToken,
} from '@onekeyhq/shared/types/staking';

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

function PopupContent({
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
      <YStack gap="$2.5">
        {items?.map(({ icon, title, value, token }) => (
          <PopupItemLine
            key={title.text}
            icon={icon}
            token={token}
            title={title}
            value={value}
          />
        ))}
      </YStack>
      {bulletList ? (
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
      {panel ? (
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

export function GridItem({
  title,
  description,
  actionIcon,
  tooltip,
}: {
  title: IEarnText;
  description?: IEarnText;
  tooltip?: IEarnText;
  actionIcon?: IEarnActionIcon;
}) {
  const actionIconButton = useMemo(() => {
    let onPress: undefined | IIconButtonProps['onPress'];
    let icon: IKeyOfIcons | undefined;
    switch (actionIcon?.type) {
      case 'link':
        icon = 'OpenOutline';
        onPress = () => openUrlExternal(actionIcon.data);
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
              <PopupContent
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
  }, [actionIcon?.data, actionIcon?.type, title.text]);
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
        {tooltip ? (
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
                <SizableText color={tooltip.color}>{tooltip.text}</SizableText>
              </Stack>
            }
          />
        ) : null}
      </XStack>
      <XStack gap="$1" alignItems="center">
        {description ? (
          <SizableText size="$bodyLgMedium" color={description.color}>
            {description.text}
          </SizableText>
        ) : null}
        {actionIconButton}
      </XStack>
    </YStack>
  );
}
