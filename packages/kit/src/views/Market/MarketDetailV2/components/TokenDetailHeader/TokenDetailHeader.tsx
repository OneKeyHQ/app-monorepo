import { XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { useTokenDetail } from '../../hooks/useTokenDetail';

import { TokenDetailHeaderLeft } from './TokenDetailHeaderLeft';
import { TokenDetailHeaderRight } from './TokenDetailHeaderRight';

export function TokenDetailHeader({
  showStats = true,
  showMediaAndSecurity = true,
}: {
  showStats?: boolean;
  showMediaAndSecurity?: boolean;
}) {
  const { tokenDetail, networkId } = useTokenDetail();

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
