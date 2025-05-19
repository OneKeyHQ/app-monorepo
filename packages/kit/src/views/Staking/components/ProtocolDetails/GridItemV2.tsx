import { useCallback, useMemo } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';

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
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type {
  IEarnActionIcon,
  IEarnIcon,
  IEarnPopupActionIcon,
  IEarnText,
} from '@onekeyhq/shared/types/staking';

function PopupItemLine({
  icon,
  title,
  value,
}: {
  icon: IEarnIcon;
  title: IEarnText;
  value: string;
}) {
  return (
    <XStack gap="$2" alignItems="center" justifyContent="space-between">
      <XStack gap="$2" alignItems="center">
        <Icon name={icon.icon} size="$5" color={icon.color} />
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
}: {
  bulletList: IEarnPopupActionIcon['data']['bulletList'];
  items: IEarnPopupActionIcon['data']['items'];
}) {
  return (
    <YStack p="$5">
      <YStack gap="$2.5">
        {items.map(({ icon, title, value }) => (
          <PopupItemLine
            key={title.text}
            icon={icon}
            title={title}
            value={value}
          />
        ))}
      </YStack>
      {bulletList ? (
        <YStack pt="$4" gap="$2">
          {bulletList.map((text, index) => (
            <SizableText
              key={index}
              size="$bodySm"
              color={text.color || '$textSubdued'}
            >
              {text.text}
            </SizableText>
          ))}
        </YStack>
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
  const openLink = useCallback(() => {
    // if (link) {
    //   openUrlExternal(link);
    // }
  }, []);
  const actionIconButton = useMemo(() => {
    let onPress: undefined | IIconButtonProps['onPress'];
    let icon: IKeyOfIcons | undefined = actionIcon?.icon?.icon;
    switch (actionIcon?.type) {
      case 'popup':
        return actionIcon.icon ? (
          <Popover
            floatingPanelProps={{
              w: 320,
            }}
            title={title.text}
            renderTrigger={
              <IconButton
                icon={actionIcon.icon.icon}
                size="small"
                variant="tertiary"
              />
            }
            renderContent={
              <PopupContent
                bulletList={actionIcon.data.bulletList}
                items={actionIcon.data.items}
              />
            }
            placement="top"
          />
        ) : null;
      case 'link':
        icon = 'OpenOutline';
        onPress = () => openUrlExternal(actionIcon.data);
        break;
      default:
    }
    return icon ? (
      <IconButton
        size="small"
        onPress={onPress}
        icon={icon}
        color="$iconSubdued"
        variant="tertiary"
      />
    ) : null;
  }, [
    actionIcon?.data.bulletList,
    actionIcon?.data.items,
    actionIcon?.icon,
    actionIcon?.type,
    title.text,
  ]);
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

        {/* {link ? (
          <Stack onPress={openLink} cursor="pointer">
            <Icon name="OpenOutline" color="$iconSubdued" size="$5" />
          </Stack>
        ) : null} */}
        {actionIconButton}
      </XStack>
    </YStack>
  );
}
