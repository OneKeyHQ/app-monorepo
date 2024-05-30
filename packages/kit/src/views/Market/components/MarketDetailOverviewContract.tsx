import { useCallback, useMemo, useState } from 'react';

import type { IButtonProps } from '@onekeyhq/components';
import { Button, SizableText, YStack } from '@onekeyhq/components';
import type { IMarketDetailPlatform } from '@onekeyhq/shared/types/market';

import { MarketTokenAddress } from './MarketTokenAddress';

export function MarketDetailOverviewContract({
  detailPlatforms,
}: {
  detailPlatforms: IMarketDetailPlatform;
}) {
  const keys = useMemo(
    () =>
      detailPlatforms ? Object.keys(detailPlatforms).filter((i) => !!i) : [],
    [detailPlatforms],
  );
  const [isShowMore, setIsShowMore] = useState(false);
  const handleViewMore = useCallback(() => {
    setIsShowMore((prev) => !prev);
  }, []);
  return keys.length ? (
    <YStack pt="$3" space="$3">
      <SizableText color="$textSubdued" size="$bodySm">
        Contract
      </SizableText>
      {keys.map((tokenName) => {
        const platform = detailPlatforms[tokenName];
        return (
          <MarketTokenAddress
            key={tokenName}
            tokenNameSize="$bodyMd"
            tokenNameColor="$textSubdued"
            addressSize="$bodyMdMedium"
            networkId={platform.onekeyNetworkId}
            tokenName={`${tokenName[0].toUpperCase()}${tokenName.slice(1)}`}
            address={platform.contract_address}
          />
        );
      })}
      {isShowMore ? (
        <Button
          size="medium"
          variant="secondary"
          onPress={handleViewMore}
          $gtMd={{ size: 'small' } as IButtonProps}
        >
          {isShowMore ? 'View More' : 'View Less'}
        </Button>
      ) : null}
    </YStack>
  ) : null;
}
