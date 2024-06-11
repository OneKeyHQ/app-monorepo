import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IMarketDetailPlatform } from '@onekeyhq/shared/types/market';

import { MarketTokenAddress } from './MarketTokenAddress';

const MAX_SHOW_NUMBER = 4;
export function MarketDetailOverviewContract({
  detailPlatforms,
}: {
  detailPlatforms?: IMarketDetailPlatform;
}) {
  const intl = useIntl();
  const keys = useMemo(
    () =>
      detailPlatforms ? Object.keys(detailPlatforms).filter((i) => !!i) : [],
    [detailPlatforms],
  );
  const isShowAllInDefault = keys.length <= MAX_SHOW_NUMBER;
  const [isShowMore, setIsShowMore] = useState(isShowAllInDefault);
  const handleViewMore = useCallback(() => {
    setIsShowMore((prev) => !prev);
  }, []);
  const showKeys = useMemo(
    () => (isShowMore ? keys : keys.slice(0, MAX_SHOW_NUMBER)),
    [isShowMore, keys],
  );
  return detailPlatforms && keys.length ? (
    <YStack pt="$3" space="$3">
      <SizableText color="$textSubdued" size="$bodySm">
        {intl.formatMessage({ id: ETranslations.global_contract })}
      </SizableText>
      {showKeys.map((tokenName) => {
        const platform = detailPlatforms[tokenName];
        return (
          <MarketTokenAddress
            key={tokenName}
            tokenNameSize="$bodyMd"
            tokenNameColor="$textSubdued"
            addressSize="$bodyMdMedium"
            networkId={platform.onekeyNetworkId}
            address={platform.contract_address}
          />
        );
      })}
      {isShowAllInDefault ? null : (
        <Button
          size="medium"
          variant="secondary"
          onPress={handleViewMore}
          $gtMd={{ size: 'small' } as IButtonProps}
        >
          {intl.formatMessage({
            id: isShowMore
              ? ETranslations.global_view_less
              : ETranslations.global_view_more,
          })}
        </Button>
      )}
    </YStack>
  ) : null;
}
