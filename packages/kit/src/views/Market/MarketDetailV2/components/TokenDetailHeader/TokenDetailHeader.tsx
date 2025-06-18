import { XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import { TokenDetailHeaderLeft } from './TokenDetailHeaderLeft';
import { TokenDetailHeaderRight } from './TokenDetailHeaderRight';

export function TokenDetailHeader({
  tokenDetail,
  networkId,
  showStats = true,
  showMediaAndSecurity = true,
}: {
  tokenDetail?: IMarketTokenDetail;
  networkId?: string;
  showStats?: boolean;
  showMediaAndSecurity?: boolean;
}) {
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
    <XStack width="100%" px="$5" pt="$4" pb="$2" jc="space-between" ai="center">
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
