import { memo, useCallback } from 'react';

import { flatMap, map } from 'lodash';
import { useIntl } from 'react-intl';

import { Alert, YStack } from '@onekeyhq/components';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import {
  useDecodedTxsAtom,
  usePreCheckTxStatusAtom,
  useSendFeeStatusAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

interface IProps {
  networkId: string;
}

function SignatureConfirmAlert(props: IProps) {
  const { networkId } = props;
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const [sendFeeStatus] = useSendFeeStatusAtom();
  const [preCheckTxStatus] = usePreCheckTxStatusAtom();
  const { network } = useAccountData({
    networkId,
  });

  const renderDecodedTxsAlert = useCallback(() => {
    const alerts = flatMap(
      map(decodedTxs, (tx) => tx.txDisplay?.alerts),
    ).filter(Boolean);

    return alerts.map((alert) => (
      <Alert
        key={alert}
        description={alert}
        type="warning"
        icon="InfoSquareOutline"
      />
    ));
  }, [decodedTxs]);

  const renderTxFeeAlert = useCallback(() => {
    if (!sendFeeStatus.errMessage) {
      return null;
    }
    return (
      <Alert
        mb="$2.5"
        fullBleed
        icon="ErrorOutline"
        type="critical"
        title={sendFeeStatus.errMessage}
        action={{
          primary: intl.formatMessage({
            id: ETranslations.global_retry,
          }),
          isPrimaryLoading: sendFeeStatus.status === ESendFeeStatus.Loading,
          onPrimaryPress() {
            appEventBus.emit(EAppEventBusNames.EstimateTxFeeRetry, undefined);
          },
        }}
      />
    );
  }, [intl, sendFeeStatus.errMessage, sendFeeStatus.status]);

  const renderInsufficientNativeBalanceAlert = useCallback(() => {
    if (!sendFeeStatus.errMessage) {
      return null;
    }
    return (
      <Alert
        fullBleed
        icon="ErrorOutline"
        type="critical"
        title={intl.formatMessage(
          {
            id: ETranslations.msg__str_is_required_for_network_fees_top_up_str_to_make_tx,
          },
          {
            crypto: network?.symbol ?? '',
          },
        )}
      />
    );
  }, [intl, network?.symbol, sendFeeStatus.errMessage]);

  const renderPreCheckTxAlert = useCallback(() => {
    if (preCheckTxStatus.errorMessage) {
      return (
        <Alert
          fullBleed
          icon="ErrorOutline"
          type="critical"
          title={preCheckTxStatus.errorMessage}
        />
      );
    }
    return null;
  }, [preCheckTxStatus]);

  return (
    <YStack gap="$2.5">
      {renderTxFeeAlert()}
      {renderInsufficientNativeBalanceAlert()}
      {renderDecodedTxsAlert()}
      {renderPreCheckTxAlert()}
    </YStack>
  );
}

export default memo(SignatureConfirmAlert);
