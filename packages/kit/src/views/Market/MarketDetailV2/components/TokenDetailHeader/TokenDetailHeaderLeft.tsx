import { useCallback } from 'react';

import {
  Divider,
  Icon,
  IconButton,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { TokenSecurityAlert } from '../TokenSecurityAlert';

interface ITokenDetailHeaderLeftProps {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  networkLogoUri?: string;
  /**
   * Controls whether to show social media links (website/twitter) and security alert.
   * Defaults to true. Set to false on views (e.g. mobile) where we want a simplified header.
   */
  showMediaAndSecurity?: boolean;
}

export function TokenDetailHeaderLeft({
  tokenDetail,
  networkId,
  networkLogoUri,
  showMediaAndSecurity = true,
}: ITokenDetailHeaderLeftProps) {
  const { copyText } = useClipboard();

  const {
    symbol = '',
    address = '',
    logoUrl = '',
    extraData,
  } = tokenDetail || {};

  const { website, twitter } = extraData || {};

  const handleCopyAddress = useCallback(() => {
    if (address) {
      copyText(address);
    }
  }, [address, copyText]);

  const handleOpenWebsite = useCallback(() => {
    if (website) {
      openUrlExternal(website);
    }
  }, [website]);

  const handleOpenTwitter = useCallback(() => {
    if (twitter) {
      openUrlExternal(twitter);
    }
  }, [twitter]);

  return (
    <XStack ai="center" gap="$2">
      <Token
        tokenImageUri={logoUrl}
        networkImageUri={networkLogoUri}
        fallbackIcon="CryptoCoinOutline"
      />

      <YStack>
        <SizableText size="$bodyLgMedium" color="$text">
          {symbol}
        </SizableText>

        <XStack gap="$2" ai="center">
          {address ? (
            <XStack
              borderRadius="$1"
              p="$0.5"
              ai="center"
              gap="$1"
              onPress={handleCopyAddress}
              cursor="pointer"
              hoverStyle={{ bg: '$bgHover' }}
              pressStyle={{ bg: '$bgActive' }}
            >
              <SizableText size="$bodySm" color="$textSubdued">
                {accountUtils.shortenAddress({
                  address,
                  leadingLength: 6,
                  trailingLength: 4,
                })}
              </SizableText>

              <Icon name="Copy1Outline" size="$4" color="$iconSubdued" />
            </XStack>
          ) : null}

          {/* Social Links & Security */}
          {showMediaAndSecurity ? (
            <>
              <Divider vertical backgroundColor="$borderSubdued" h="$3" />

              {tokenDetail?.address && networkId ? (
                <>
                  <TokenSecurityAlert />
                </>
              ) : null}

              <Divider vertical backgroundColor="$borderSubdued" h="$3" />

              <XStack gap="$1" ai="center">
                {website ? (
                  <IconButton
                    icon="GlobusOutline"
                    onPress={handleOpenWebsite}
                    variant="tertiary"
                    iconProps={{ width: 16, height: 16 }}
                  />
                ) : null}

                {twitter ? (
                  <IconButton
                    icon="Xbrand"
                    onPress={handleOpenTwitter}
                    variant="tertiary"
                    iconProps={{ width: 16, height: 16 }}
                  />
                ) : null}
              </XStack>
            </>
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  );
}
