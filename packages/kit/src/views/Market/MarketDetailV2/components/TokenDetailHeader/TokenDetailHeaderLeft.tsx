import {
  Divider,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { TokenSecurityAlert } from '../TokenSecurityAlert';

import { useTokenDetailHeaderLeftActions } from './hooks/useTokenDetailHeaderLeftActions';

interface ITokenDetailHeaderLeftProps {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  networkLogoUri?: string;
  showMediaAndSecurity?: boolean;
}

export function TokenDetailHeaderLeft({
  tokenDetail,
  networkId,
  networkLogoUri,
  showMediaAndSecurity = true,
}: ITokenDetailHeaderLeftProps) {
  const {
    handleCopyAddress,
    handleOpenContractAddress,
    handleOpenWebsite,
    handleOpenTwitter,
    handleOpenXSearch,
  } = useTokenDetailHeaderLeftActions({
    tokenDetail,
    networkId,
  });

  const {
    symbol = '',
    address = '',
    logoUrl = '',
    extraData,
  } = tokenDetail || {};

  const { website, twitter } = extraData || {};

  return (
    <XStack ai="center" gap="$2">
      <Token
        size="md"
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
            <XStack borderRadius="$1" ai="center" gap="$1">
              <SizableText
                size="$bodySm"
                color="$textSubdued"
                cursor="pointer"
                hoverStyle={{ color: '$text' }}
                pressStyle={{ color: '$textActive' }}
                onPress={handleOpenContractAddress}
              >
                {accountUtils.shortenAddress({
                  address,
                  leadingLength: 6,
                  trailingLength: 4,
                })}
              </SizableText>

              <IconButton
                onPress={handleCopyAddress}
                variant="tertiary"
                iconProps={{ width: 16, height: 16 }}
                icon="Copy3Outline"
                color="$iconSubdued"
              />
            </XStack>
          ) : null}

          {/* Social Links & Security */}
          {showMediaAndSecurity ? (
            <>
              {address && networkId ? (
                <>
                  <Divider vertical backgroundColor="$borderSubdued" h="$3" />

                  <TokenSecurityAlert />
                </>
              ) : null}

              {website || twitter || address ? (
                <>
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

                    {address ? (
                      <IconButton
                        icon="SearchOutline"
                        onPress={handleOpenXSearch}
                        variant="tertiary"
                        iconProps={{ width: 16, height: 16 }}
                      />
                    ) : null}
                  </XStack>
                </>
              ) : null}
            </>
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  );
}
