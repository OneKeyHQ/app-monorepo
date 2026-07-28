import { type RouteProp, useRoute } from '@react-navigation/core';

import { Page } from '@onekeyhq/components';
import { ProtocolLendingActionContent } from '@onekeyhq/kit/src/components/DeFi/ProtocolLendingActionDialogContent';
import { ProtocolPositionActionDialogContent } from '@onekeyhq/kit/src/components/DeFi/ProtocolPositionActionDialog';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';

export default function DeFiProtocolAction() {
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.DeFiProtocolAction
      >
    >();
  const params = route.params;

  return (
    <Page safeAreaEnabled={false}>
      {params.mode === 'lending' ? (
        <ProtocolLendingActionContent
          accountId={params.accountId}
          networkId={params.networkId}
          actionType={params.actionType}
          source={params.source}
          hasDebts={params.hasDebts}
          onSuccess={params.onSuccess}
          renderMode="page"
        />
      ) : (
        <ProtocolPositionActionDialogContent
          accountId={params.accountId}
          networkId={params.networkId}
          action={params.action}
          hasRewards={params.hasRewards}
          hasDebts={params.hasDebts}
          rewardAssets={params.rewardAssets}
          onSuccess={params.onSuccess}
          renderMode="page"
        />
      )}
    </Page>
  );
}
