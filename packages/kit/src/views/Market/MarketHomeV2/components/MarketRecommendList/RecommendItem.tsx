import { useMemo } from 'react';

import {
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  getSharedButtonStyles,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketTokenIcon } from '../../../components/MarketTokenIcon';

export function RecommendItem({
  icon,
  checked = false,
  onChange,
  tokenName,
  symbol,
  address,
}: {
  icon: string;
  tokenName: string;
  checked: boolean;
  symbol: string;
  address: string;
  onChange: (checked: boolean, address: string) => void;
}) {
  const { sharedFrameStyles } = useMemo(
    () =>
      getSharedButtonStyles({
        disabled: false,
        loading: false,
      }),
    [],
  );
  return (
    <XStack
      userSelect="none"
      flexGrow={1}
      flexBasis={0}
      justifyContent="space-between"
      px={platformEnv.isExtensionUiPopup ? '$3' : '$4'}
      py={platformEnv.isExtensionUiPopup ? '$1.5' : '$3.5'}
      borderRadius="$3"
      onPress={() => {
        onChange(!checked, address);
      }}
      ai="center"
      {...sharedFrameStyles}
    >
      <XStack gap="$3" ai="center" flexShrink={1}>
        <MarketTokenIcon uri={icon} size="lg" />
        <YStack flexShrink={1}>
          <SizableText size="$bodyLgMedium" numberOfLines={1}>
            {symbol.toUpperCase()}
          </SizableText>
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            flexShrink={1}
            numberOfLines={1}
          >
            {tokenName}
          </SizableText>
        </YStack>
      </XStack>
      {checked ? (
        <Icon name="CheckRadioSolid" size="$6" color="$iconActive" />
      ) : (
        <Stack w="$6" h="$6" />
      )}
    </XStack>
  );
}
