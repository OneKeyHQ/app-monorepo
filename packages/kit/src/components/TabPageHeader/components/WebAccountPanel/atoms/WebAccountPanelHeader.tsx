import type { ReactNode } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IXStackProps } from '@onekeyhq/components';

export interface IWebAccountPanelHeaderProps extends IXStackProps {
  title: ReactNode;
  onBack: () => void;
}

export function WebAccountPanelHeader({
  title,
  onBack,
  ...stackProps
}: IWebAccountPanelHeaderProps) {
  return (
    <XStack
      ai="center"
      px="$5"
      py="$4"
      w="100%"
      borderBottomWidth={1}
      borderBottomColor="$neutral3"
      {...stackProps}
    >
      <XStack
        ai="center"
        gap="$2"
        borderRadius="$full"
        role="button"
        cursor="pointer"
        py="$1.5"
        px="$2"
        mx="$-2"
        my="$-1.5"
        hoverStyle={{ bg: '$bgHover' }}
        pressStyle={{ bg: '$bgActive' }}
        onPress={onBack}
        focusable
        focusVisibleStyle={{
          outlineWidth: 2,
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
        }}
      >
        <XStack ai="center" px="$0.5">
          <Icon name="ArrowLeftOutline" size="$5" color="$iconSubdued" />
        </XStack>
        {typeof title === 'string' ? (
          <SizableText size="$bodyMdMedium" color="$textSubdued">
            {title}
          </SizableText>
        ) : (
          title
        )}
      </XStack>
    </XStack>
  );
}
