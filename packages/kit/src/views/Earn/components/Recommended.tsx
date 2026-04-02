import type { IYStackProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';

import { RecommendedSection } from './RecommendedSection';

export function Recommended(
  props:
    | {
        disableHorizontalBleed?: boolean;
        recommendedItemContainerProps?: IYStackProps;
        withHeader?: boolean;
        enableFetch?: boolean;
      }
    | undefined,
) {
  const {
    disableHorizontalBleed = false,
    recommendedItemContainerProps,
    withHeader = true,
    enableFetch = true,
  } = props ?? {};

  const allNetworkId = getNetworkIdsMap().onekeyall;
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ refreshTrigger = 0, recommendedTokens = [] }] = useEarnAtom();
  const actions = useEarnActions();

  const noWalletConnected = !account && !indexedAccount;

  usePromiseResult(
    async () => {
      if (!enableFetch) {
        return recommendedTokens;
      }

      const recommendedAssets =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
          accountId: account?.id ?? '',
          networkId: allNetworkId,
          indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
        });

      const newTokens = recommendedAssets?.tokens || [];
      actions.current.updateRecommendedTokens(newTokens);

      return newTokens;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      enableFetch,
      account?.id,
      allNetworkId,
      account?.indexedAccountId,
      indexedAccount?.id,
      refreshTrigger,
    ],
    {
      watchLoading: true,
      overrideIsFocused: (isFocused) => isFocused && enableFetch,
    },
  );

  return (
    <RecommendedSection
      tokens={recommendedTokens}
      noWalletConnected={noWalletConnected}
      withHeader={withHeader}
      disableHorizontalBleed={disableHorizontalBleed}
      recommendedItemContainerProps={recommendedItemContainerProps}
      showSkeleton={recommendedTokens.length === 0}
    />
  );
}
