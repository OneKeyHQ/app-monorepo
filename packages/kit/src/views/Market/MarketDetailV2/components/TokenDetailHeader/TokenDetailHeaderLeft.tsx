import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  InteractiveIcon,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EWatchlistFrom } from '@onekeyhq/shared/src/logger/scopes/dex';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { MarketStarV2 } from '../../../components/MarketStarV2';
import { TokenSecurityAlert } from '../TokenSecurityAlert';

import { useTokenDetailHeaderLeftActions } from './hooks/useTokenDetailHeaderLeftActions';
import { ShareButton } from './ShareButton';

interface ITokenDetailHeaderLeftProps {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  networkLogoUri?: string;
  showMediaAndSecurity?: boolean;
  isNative?: boolean;
}

export function TokenDetailHeaderLeft({
  tokenDetail,
  networkId,
  networkLogoUri,
  showMediaAndSecurity = true,
  isNative = false,
}: ITokenDetailHeaderLeftProps) {
  const intl = useIntl();
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
    communityRecognized,
  } = tokenDetail || {};

  const { website, twitter } = extraData || {};

  const marketStar = networkId ? (
    <MarketStarV2
      chainId={networkId}
      contractAddress={address}
      size="medium"
      from={EWatchlistFrom.Detail}
      tokenSymbol={symbol}
      isNative={isNative}
    />
  ) : null;

  return (
    <XStack ai="center" gap="$2">
      {marketStar}

      <Token
        size="md"
        tokenImageUri={logoUrl}
        networkImageUri={networkLogoUri}
        fallbackIcon="CryptoCoinOutline"
      />

      <YStack>
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyLgMedium" color="$text">
            {symbol}
          </SizableText>
          {communityRecognized ? (
            <Tooltip
              placement="top"
              renderTrigger={
                <Icon
                  name="BadgeRecognizedSolid"
                  size="$4"
                  color="$iconSuccess"
                />
              }
              renderContent={
                <SizableText size="$bodySm">
                  {intl.formatMessage({
                    id: ETranslations.dexmarket_communityRecognized,
                  })}
                </SizableText>
              }
            />
          ) : null}
        </XStack>

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

              <InteractiveIcon
                icon="Copy3Outline"
                onPress={handleCopyAddress}
                size="$4"
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

                  <XStack gap="$2" ai="center">
                    {website ? (
                      <InteractiveIcon
                        icon="GlobusOutline"
                        onPress={handleOpenWebsite}
                        size="$4"
                      />
                    ) : null}

                    {twitter ? (
                      <InteractiveIcon
                        icon="Xbrand"
                        onPress={handleOpenTwitter}
                        size="$4"
                      />
                    ) : null}

                    {address ? (
                      <InteractiveIcon
                        icon="SearchOutline"
                        onPress={handleOpenXSearch}
                        size="$4"
                      />
                    ) : null}

                    {networkId ? (
                      <ShareButton
                        networkId={networkId}
                        address={address}
                        isNative={isNative}
                        size="$4"
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
