import type { ReactNode } from 'react';

import type { IButtonProps, IXStackProps } from '@onekeyhq/components';
import {
  Icon,
  LottieView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import type { IActivityHubShortcutBasis } from './layout';

export const MENU_SHORTCUT_GRID_PROPS: IXStackProps = {
  px: '$2',
  pt: '$1.5',
  pb: '$1.5',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
};

export function ActivityShortcutCard({
  title,
  subtitle,
  leadingContent,
  iconName,
  iconBadge,
  lottieSrc,
  showIconBackground = false,
  menuLayout = false,
  listLayout = false,
  flexBasis,
  testID,
  onPress,
}: {
  title: string;
  subtitle?: string;
  leadingContent?: ReactNode;
  iconName?: IButtonProps['icon'];
  iconBadge?: ReactNode;
  lottieSrc?: object;
  showIconBackground?: boolean;
  menuLayout?: boolean;
  listLayout?: boolean;
  flexBasis: IActivityHubShortcutBasis;
  testID?: string;
  onPress: () => void;
}) {
  const themeVariant = useThemeVariant();
  const iconBackground =
    menuLayout && themeVariant === 'dark' ? '$bgStrong' : '$bgSubdued';
  const iconBorderRadius = showIconBackground ? '$3' : '$0';
  const defaultTitleSize = showIconBackground ? '$bodySm' : '$bodySmMedium';
  if (listLayout) {
    return (
      <XStack
        testID={testID}
        minHeight="$11"
        px="$3"
        py="$2.5"
        gap="$3"
        alignItems={subtitle ? 'flex-start' : 'center'}
        borderRadius="$3"
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={onPress}
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        cursor="pointer"
        userSelect="none"
      >
        <Stack
          w="$5"
          h="$6"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          {leadingContent ??
            (iconName ? (
              <Icon name={iconName} size="$5" color="$text" />
            ) : null)}
        </Stack>
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyMdMedium">{title}</SizableText>
          {subtitle ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {subtitle}
            </SizableText>
          ) : null}
        </YStack>
        <Stack h="$6" justifyContent="center">
          <Icon name="ChevronRightOutline" size="$4" color="$iconSubdued" />
        </Stack>
      </XStack>
    );
  }
  return (
    <YStack
      testID={testID}
      flexBasis={flexBasis}
      flexShrink={0}
      minWidth={0}
      borderRadius={menuLayout ? '$3' : '$2'}
      px={menuLayout ? '$1' : undefined}
      py={menuLayout ? '$3' : '$2.5'}
      accessibilityRole="button"
      accessibilityLabel={title}
      gap={showIconBackground ? '$2' : '$1'}
      alignItems="center"
      justifyContent="flex-start"
      onPress={onPress}
      hoverStyle={menuLayout ? { opacity: 0.8 } : { bg: '$bgHover' }}
      pressStyle={menuLayout ? { opacity: 0.6 } : { bg: '$bgActive' }}
      cursor={menuLayout ? 'pointer' : 'default'}
      userSelect="none"
    >
      <Stack
        w={showIconBackground ? '$12' : '$6'}
        h={showIconBackground ? '$12' : '$6'}
        borderRadius={menuLayout ? '$4' : iconBorderRadius}
        bg={showIconBackground ? iconBackground : undefined}
        ai="center"
        jc="center"
        position="relative"
      >
        {iconName ? (
          <Icon
            name={iconName}
            size={showIconBackground && !menuLayout ? '$7' : '$6'}
            color={menuLayout ? '$text' : '$icon'}
          />
        ) : null}
        {lottieSrc ? (
          <LottieView width={32} height={32} source={lottieSrc} />
        ) : null}
        {iconBadge ? (
          <Stack position="absolute" top="$1" right="$1" pointerEvents="none">
            {iconBadge}
          </Stack>
        ) : null}
      </Stack>
      <SizableText
        size={menuLayout ? '$headingXxs' : defaultTitleSize}
        fontWeight={menuLayout ? '400' : undefined}
        textTransform={menuLayout ? 'none' : undefined}
        letterSpacing={menuLayout ? 0 : undefined}
        textAlign="center"
        width={menuLayout ? '100%' : undefined}
        numberOfLines={menuLayout ? undefined : 2}
        color={showIconBackground ? '$text' : '$textSubdued'}
      >
        {title}
      </SizableText>
    </YStack>
  );
}
