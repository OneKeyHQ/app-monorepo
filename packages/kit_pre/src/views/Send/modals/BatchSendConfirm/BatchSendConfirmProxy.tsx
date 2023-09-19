import { useMemo } from 'react';

import { ENABLED_DAPP_SCOPE } from '@onekeyhq/shared/src/background/backgroundUtils';

import { BatchSendConfirmModalBase } from '../../components/BatchSendConfirmModalBase';
import { SendConfirmErrorsAlert } from '../../components/SendConfirmErrorsAlert';
import { useBatchSendConfirmRouteParamsParsed } from '../../utils/useBatchSendConfirmRouteParamsParsed';

import { BatchSendConfirm } from './BatchSendConfirm';

function BatchSendConfirmProxy() {
  const batchSendConfirmParamsParsed = useBatchSendConfirmRouteParamsParsed();
  const { sourceInfo, routeParams } = batchSendConfirmParamsParsed;
  const isNetworkNotMatched = useMemo(() => {
    if (!sourceInfo) {
      return false;
    }
    // dapp tx should check scope matched
    // TODO add injectedProviderName to vault settings
    return !ENABLED_DAPP_SCOPE.includes(sourceInfo.scope); // network.settings.injectedProviderName
  }, [sourceInfo]);

  if (isNetworkNotMatched) {
    return (
      <BatchSendConfirmModalBase
        accountId={routeParams.accountId}
        networkId={routeParams.networkId}
        batchSendConfirmParams={routeParams}
        feeInfoPayloads={[]}
        feeInfoLoading={false}
        encodedTxs={[]}
        decodedTxs={[]}
        totalFeeInNative={0}
        handleConfirm={() => null}
      >
        <SendConfirmErrorsAlert isNetworkNotMatched />
      </BatchSendConfirmModalBase>
    );
  }
  return (
    <BatchSendConfirm
      batchSendConfirmParamsParsed={batchSendConfirmParamsParsed}
    />
  );
}

export default BatchSendConfirmProxy;
