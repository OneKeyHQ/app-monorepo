import type { FC } from 'react';
import { memo, useMemo } from 'react';

import {
  Icon,
  NATIVE_HIT_SLOP,
  NumberSizeableText,
  SizableText,
  Stack,
  Tooltip,
  XStack,
  useClipboard,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { CommunityRecognizedBadge } from '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge';
import {
  LeverageBadge,
  StockSourceLogo,
  SubtitleText,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { TokenTagsPopover } from '@onekeyhq/kit/src/views/Market/components/TokenTagsPopover';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ECopyFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

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
   * Token logo URIs for fallback loading.
   */
  tokenLogoURIs?: string[];
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
  /**
   * Where the copy action is triggered from.
   */
  copyFrom?: ECopyFrom;
  /**
   * Whether the token is community recognized.
   */
  communityRecognized?: boolean;
  /**
   * Stock info for tokenized real-world assets.
   */
  stock?: IMarketStockInfo;
  /**
   * Max leverage for perpetual tokens (e.g. 40 for "40x").
   */
  maxLeverage?: number;
  /**
   * Subtitle for perpetual tokens (e.g. Chinese name tag).
   */
  perpsSubtitle?: string;
  /**
   * Whether to show the stock subtitle. Defaults to true.
   */
  showStockSubtitle?: boolean;
}

const BasicTokenIdentityItem: FC<ITokenIdentityItemProps> = ({
  symbol,
  address,
  tokenLogoURI,
  tokenLogoURIs,
  networkLogoURI,
  networkId,
  onCopied,
  showCopyButton = false,
  showVolume = false,
  volume,
  copyFrom = ECopyFrom.Homepage,
  communityRecognized,
  stock,
  maxLeverage,
  perpsSubtitle,
  showStockSubtitle = true,
}) => {
  const { gtMd } = useMedia();
  const { copyText } = useClipboard();
  // Use hook to get network logo with async fallback
  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: networkLogoURI,
    networkId,
  });

  const shortened = useMemo(
    () =>
      accountUtils.shortenAddress({
        address,
        leadingLength: 6,
        trailingLength: 4,
      }),
    [address],
  );

  const shouldShowVolume = showVolume && !!volume;
  const shouldShowAddress = !showVolume && Boolean(address);
  const shouldShowCopyButton = showCopyButton && Boolean(address);
  // Localized name shown as plain text on the second row, before volume/address.
  let localizedName: string | undefined;
  if (showStockSubtitle && stock?.subtitle) {
    localizedName = stock.subtitle;
  } else if (!stock?.subtitle && perpsSubtitle) {
    localizedName = perpsSubtitle;
  }
  const shouldShowSecondRow =
    shouldShowVolume || shouldShowAddress || !!localizedName;

  const handleCopy = (e: GestureResponderEvent) => {
    e.stopPropagation();
    copyText(address);
    onCopied?.(address);
    // Dex analytics
    defaultLogger.dex.actions.dexCopyCA({
      copyFrom,
      copiedContent: address,
    });
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

  const symbolText = (
    <SizableText
      size="$bodyLgMedium"
      numberOfLines={1}
      ellipsizeMode="tail"
      maxWidth="$32"
      flexShrink={1}
    >
      {symbol}
    </SizableText>
  );

  const symbolElement =
    !showStockSubtitle && stock?.subtitle ? (
      <Tooltip
        placement="top"
        renderTrigger={symbolText}
        renderContent={stock.subtitle}
      />
    ) : (
      symbolText
    );

  return (
    <XStack alignItems="center" gap="$3" userSelect="none">
      <Token
        tokenImageUri={getTokenImageUri()}
        tokenImageUris={tokenLogoURIs}
        networkImageUri={effectiveNetworkLogoUri}
        fallbackIcon="CryptoCoinOutline"
        size="md"
      />

      <Stack flex={1} minWidth={0}>
        <XStack alignItems="center" gap="$1">
          {symbolElement}
          {maxLeverage ? <LeverageBadge leverage={maxLeverage} /> : null}
          {gtMd ? (
            <>
              <StockSourceLogo stock={stock} />
              {communityRecognized ? <CommunityRecognizedBadge /> : null}
            </>
          ) : (
            <TokenTagsPopover
              communityRecognized={communityRecognized}
              stock={stock}
            />
          )}
        </XStack>
        {shouldShowSecondRow ? (
          <XStack alignItems="center" gap="$1.5" minWidth={0}>
            {localizedName ? (
              // Cap the localized name so long names truncate with an
              // ellipsis, e.g. "Circle Int...", keeping the row compact.
              <SubtitleText subtitle={localizedName} maxWidth={66} />
            ) : null}
            {/* Divider only before the address (desktop); the name and
               volume (mobile) are separated by spacing alone. */}
            {localizedName && shouldShowAddress ? (
              <SizableText size="$bodySm" color="$textDisabled" flexShrink={0}>
                |
              </SizableText>
            ) : null}
            {shouldShowVolume ? (
              <NumberSizeableText
                size={gtMd ? '$bodySm' : '$bodyMd'}
                color="$textSubdued"
                numberOfLines={1}
                formatter="marketCap"
                formatterOptions={{ currency: '$' }}
              >
                {volume}
              </NumberSizeableText>
            ) : null}
            {shouldShowAddress ? (
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                numberOfLines={1}
                flexShrink={0}
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
