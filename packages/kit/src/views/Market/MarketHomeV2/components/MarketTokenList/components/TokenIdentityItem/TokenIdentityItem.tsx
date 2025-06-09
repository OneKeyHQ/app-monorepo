import type { FC } from 'react';
import { memo, useMemo } from 'react';

import {
  Icon,
  NATIVE_HIT_SLOP,
  SizableText,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import type { GestureResponderEvent } from 'react-native';

interface ITokenIdentityItemProps {
  /**
   * Token display symbol, e.g. `SOL`.
   */
  symbol: string;
  /**
   * Address represented by this token. Will be truncated for display but the
   * full value is preserved for copy action.
   */
  address: string;
  /**
   * Token logo URI.
   */
  tokenLogoURI?: string;
  /**
   * Network logo URI – mutually exclusive with `networkId`. If both are
   * provided `networkLogoURI` takes precedence.
   */
  networkLogoURI?: string;
  /**
   * Network id to resolve the network avatar from the built-in list.
   * Only used when `networkLogoURI` is not provided.
   */
  networkId?: string;
  /**
   * Callback fired after the copy button is pressed and the text has been
   * copied. Useful when the parent component needs to react.
   */
  onCopied?: (address: string) => void;
  /**
   * Whether to show the copy button. Defaults to false.
   */
  showCopyButton?: boolean;
}

const BasicTokenIdentityItem: FC<ITokenIdentityItemProps> = ({
  symbol,
  address,
  tokenLogoURI,
  networkLogoURI,
  onCopied,
  showCopyButton = false,
}) => {
  const { copyText } = useClipboard();

  const shortened = useMemo(
    () =>
      accountUtils.shortenAddress({
        address,
        leadingLength: 6,
        trailingLength: 4,
      }),
    [address],
  );

  const handleCopy = (e: GestureResponderEvent) => {
    e.stopPropagation();
    copyText(address);
    onCopied?.(address);
  };

  return (
    <XStack alignItems="center" gap="$3" userSelect="none">
      <Token
        tokenImageUri={tokenLogoURI}
        networkImageUri={networkLogoURI}
        fallbackIcon="CryptoCoinOutline"
      />

      <Stack flex={1} minWidth={0}>
        <SizableText size="$bodyLgMedium" numberOfLines={1}>
          {symbol}
        </SizableText>
        <SizableText
          fontFamily="$monoRegular"
          size="$bodyMd"
          color="$textSubdued"
          numberOfLines={1}
        >
          {shortened}
        </SizableText>
      </Stack>

      {showCopyButton ? (
        <Stack
          cursor="pointer"
          p="$1"
          borderRadius="$full"
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          hitSlop={NATIVE_HIT_SLOP}
          onPress={handleCopy}
        >
          <Icon name="Copy2Outline" size="$5" color="$iconSubdued" />
        </Stack>
      ) : null}
    </XStack>
  );
};

export const TokenIdentityItem = memo(BasicTokenIdentityItem);
