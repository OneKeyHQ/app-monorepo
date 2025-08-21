import { useMemo } from 'react';

import {
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
  getSharedButtonStyles,
} from '@onekeyhq/components';

import { MarketTokenIcon } from '../../../components/MarketTokenIcon';

export function RecommendItem({
  icon,
  checked = false,
  onChange,
  tokenName,
  symbol,
  address,
  networkId,
}: {
  icon: string;
  tokenName: string;
  checked: boolean;
  symbol: string;
  address: string;
  networkId?: string;
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
      px="$4"
      py="$2"
      borderRadius="$3"
      {...sharedFrameStyles}
      borderWidth={1}
      borderColor="$neutral3"
      onPress={() => {
        onChange(!checked, address);
      }}
      ai="center"
      $sm={{
        px: '$2.5',
        py: '$1.5',
      }}
    >
      <XStack gap="$3" ai="center" flexShrink={1}>
        <MarketTokenIcon uri={icon} size="md" networkId={networkId} />
        <YStack flexShrink={1}>
          <SizableText
            size="$bodyLgMedium"
            numberOfLines={1}
            $sm={{
              size: '$bodyMdMedium',
            }}
          >
            {symbol}
          </SizableText>
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            flexShrink={1}
            numberOfLines={1}
            maxWidth={120}
            $sm={{
              maxWidth: 70,
            }}
          >
            {tokenName}
          </SizableText>
        </YStack>
      </XStack>
      {checked ? (
        <Icon
          name="CheckRadioSolid"
          size="$6"
          color="$iconActive"
          $sm={{ size: '$5' }}
        />
      ) : (
        <Stack w="$6" h="$6" $sm={{ w: '$5', h: '$5' }} />
      )}
    </XStack>
  );
}
