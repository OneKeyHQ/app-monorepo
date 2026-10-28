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
  disabled = false,
  onChange,
  tokenName,
  symbol,
  address,
  networkId,
  compact = false,
}: {
  icon: string;
  tokenName: string;
  checked: boolean;
  disabled?: boolean;
  symbol: string;
  address: string;
  networkId?: string;
  onChange: (checked: boolean, address: string) => void;
  // Small-screen sizing regardless of the window, for narrow containers such
  // as the detail page's favorites sidebar on a wide window.
  compact?: boolean;
}) {
  const { sharedFrameStyles } = useMemo(
    () =>
      getSharedButtonStyles({
        disabled,
        loading: false,
      }),
    [disabled],
  );
  return (
    <XStack
      userSelect="none"
      flexGrow={1}
      flexBasis={0}
      justifyContent="space-between"
      px={compact ? '$2.5' : '$4'}
      py={compact ? '$1.5' : '$2'}
      borderRadius="$3"
      {...sharedFrameStyles}
      borderWidth={1}
      borderColor="$neutral3"
      onPress={() => {
        if (disabled) {
          return;
        }
        onChange(!checked, address);
      }}
      ai="center"
      $sm={{
        px: '$2.5',
        py: '$1.5',
      }}
    >
      <XStack gap={compact ? '$2' : '$3'} ai="center" flexShrink={1}>
        <MarketTokenIcon uri={icon} size="md" networkId={networkId} />
        <YStack
          flexShrink={1}
          {...(platformEnv.isNativeAndroid
            ? {
                width: '$20',
                height: '$9',
                justifyContent: 'center',
              }
            : {})}
        >
          <XStack alignItems="center" gap="$1">
            <SizableText
              size={compact ? '$bodyMdMedium' : '$bodyLgMedium'}
              numberOfLines={1}
              flexShrink={1}
              $sm={{
                size: '$bodyMdMedium',
              }}
            >
              {symbol}
            </SizableText>
          </XStack>
          {/* A compact card has no room for the name next to the symbol. */}
          {compact ? null : (
            <XStack>
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
            </XStack>
          )}
        </YStack>
      </XStack>
      {checked ? (
        <Icon
          name="CheckRadioSolid"
          size={compact ? '$5' : '$6'}
          color="$iconActive"
          $sm={{ size: '$5' }}
        />
      ) : (
        <Stack
          w={compact ? '$5' : '$6'}
          h={compact ? '$5' : '$6'}
          $sm={{ w: '$5', h: '$5' }}
        />
      )}
    </XStack>
  );
}
