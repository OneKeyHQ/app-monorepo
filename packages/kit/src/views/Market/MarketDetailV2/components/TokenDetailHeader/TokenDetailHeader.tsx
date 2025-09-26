import type { ComponentProps } from 'react';
import { useMemo } from 'react';

import { XStack, useMedia } from '@onekeyhq/components';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TokenDetailHeaderLeft } from './TokenDetailHeaderLeft';
import { TokenDetailHeaderRight } from './TokenDetailHeaderRight';

export function TokenDetailHeader({
  showStats = true,
  showMediaAndSecurity = true,
  containerProps,
  isNative = false,
}: {
  showStats?: boolean;
  showMediaAndSecurity?: boolean;
  containerProps?: ComponentProps<typeof XStack>;
  isNative?: boolean;
}) {
  const { tokenDetail, networkId } = useTokenDetail();
  const media = useMedia();

  const networkData = useMemo(() => {
    return networkId ? networkUtils.getLocalNetworkInfo(networkId) : undefined;
  }, [networkId]);

  return (
    <XStack
      width={media.lg ? '90%' : '100%'}
      px="$5"
      pt="$4"
      pb="$2"
      jc="space-between"
      ai="center"
      bg="green3"
      {...containerProps}
    >
      <TokenDetailHeaderLeft
        tokenDetail={tokenDetail}
        networkId={networkId}
        networkLogoUri={networkData?.logoURI}
        showMediaAndSecurity={showMediaAndSecurity}
      />

      <TokenDetailHeaderRight
        tokenDetail={tokenDetail}
        networkId={networkId}
        showStats={showStats}
        isNative={isNative}
      />
    </XStack>
  );
}
