import {
  Divider,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import { NATIVE_HIT_SLOP } from '@onekeyhq/components/src/utils';
import { Token } from '@onekeyhq/kit/src/components/Token';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { TokenSecurityAlert } from '../TokenSecurityAlert';

import { useTokenDetailHeaderLeftActions } from './hooks/useTokenDetailHeaderLeftActions';

function InteractiveIcon({
  icon,
  onPress,
  size = '$4',
}: {
  icon: IKeyOfIcons;
  onPress: () => void;
  size?: IIconProps['size'];
}) {
  return (
    <Stack
      w={size}
      h={size}
      cursor="pointer"
      onPress={onPress}
      hitSlop={NATIVE_HIT_SLOP}
      group
    >
      <Icon
        name={icon}
        size={size}
        color="$iconSubdued"
        $group-hover={{ color: '$iconHover' }}
      />
    </Stack>
  );
}

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

                  <XStack gap="$1" ai="center">
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
