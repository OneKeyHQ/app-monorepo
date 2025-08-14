import type { ComponentProps } from 'react';

import { XStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TokenDetailHeaderLeft } from './TokenDetailHeaderLeft';
import { TokenDetailHeaderRight } from './TokenDetailHeaderRight';

export function TokenDetailHeader({
  showStats = true,
  showMediaAndSecurity = true,
  containerProps,
}: {
  showStats?: boolean;
  showMediaAndSecurity?: boolean;
  containerProps?: ComponentProps<typeof XStack>;
}) {
  const { tokenDetail, networkId } = useTokenDetail();
  const media = useMedia();

  const { result: networkData } = usePromiseResult(
    () =>
      networkId
        ? backgroundApiProxy.serviceNetwork.getNetwork({ networkId })
        : Promise.resolve(undefined),
    [networkId],
    {
      checkIsFocused: false,
      overrideIsFocused: () => false,
    },
  );

  return (
    <XStack
      width={media.lg ? '90%' : '100%'}
      px="$5"
      pt="$4"
      pb="$2"
      jc="space-between"
      ai="center"
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
      />
    </XStack>
  );
}
