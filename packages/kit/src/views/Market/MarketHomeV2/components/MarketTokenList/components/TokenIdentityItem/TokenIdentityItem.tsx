import type { FC } from 'react';
import { memo, useMemo } from 'react';

import {
  Icon,
  NATIVE_HIT_SLOP,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
  /**
   * Whether to show volume instead of address. Defaults to false.
   */
  showVolume?: boolean;
  /**
   * Volume value to display when showVolume is true.
   */
  volume?: number;
}

const BasicTokenIdentityItem: FC<ITokenIdentityItemProps> = ({
  symbol,
  address,
  tokenLogoURI,
  networkLogoURI,
  onCopied,
  showCopyButton = false,
  showVolume = false,
  volume,
}) => {
  const { gtMd } = useMedia();
  const { copyText } = useClipboard();
  const [settings] = useSettingsPersistAtom();
  const currency = settings.currencyInfo.symbol;

  const shortened = useMemo(
    () =>
      accountUtils.shortenAddress({
        address,
        leadingLength: 6,
        trailingLength: 4,
      }),
    [address],
  );

  const shouldShowVolume = showVolume && volume !== undefined;
  const shouldShowAddress = !showVolume && Boolean(address);
  const shouldShowCopyButton = showCopyButton && Boolean(address);
  const shouldShowSecondRow = shouldShowVolume || shouldShowAddress;

  const handleCopy = (e: GestureResponderEvent) => {
    e.stopPropagation();
    copyText(address);
    onCopied?.(address);
  };

  const getTokenImageUri = () => {
    if (!platformEnv.isNative || !tokenLogoURI) {
      return tokenLogoURI;
    }

    if (tokenLogoURI.toLowerCase().includes('svg')) {
      return undefined;
    }

    return tokenLogoURI;
  };

  return (
    <XStack alignItems="center" gap="$3" userSelect="none">
      <Token
        tokenImageUri={getTokenImageUri()}
        networkImageUri={address ? networkLogoURI : undefined}
        fallbackIcon="CryptoCoinOutline"
        size="md"
      />

      <Stack flex={1} minWidth={0}>
        <SizableText
          width={100}
          size="$bodyLgMedium"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {symbol}
        </SizableText>
        {shouldShowSecondRow ? (
          <XStack alignItems="center" gap="$1" height="$4">
            {shouldShowVolume ? (
              <NumberSizeableText
                size={gtMd ? '$bodySm' : '$bodyMd'}
                color="$textSubdued"
                numberOfLines={1}
                formatter="marketCap"
                formatterOptions={{ currency }}
              >
                {volume}
              </NumberSizeableText>
            ) : null}
            {shouldShowAddress ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
              >
                {shortened}
              </SizableText>
            ) : null}
            {shouldShowCopyButton ? (
              <Stack
                cursor="pointer"
                p="$1"
                borderRadius="$full"
                hoverStyle={{ bg: '$bgHover' }}
                pressStyle={{ bg: '$bgActive' }}
                hitSlop={NATIVE_HIT_SLOP}
                onPress={handleCopy}
              >
                <Icon name="Copy3Outline" size="$4" color="$iconSubdued" />
              </Stack>
            ) : null}
          </XStack>
        ) : null}
      </Stack>
    </XStack>
  );
};

export const TokenIdentityItem = memo(BasicTokenIdentityItem);
