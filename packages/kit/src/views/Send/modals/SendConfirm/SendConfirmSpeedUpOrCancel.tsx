import { useMemo } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Alert, Center, Spinner } from '@onekeyhq/components';
import { OneKeyError } from '@onekeyhq/engine/src/errors';

import { BaseSendConfirmModal } from '../../components/BaseSendConfirmModal';
import { FeeInfoInputForSpeedUpOrCancel } from '../../components/FeeInfoInput';

import type {
  ITxConfirmViewProps,
  SendModalRoutes,
  SendRoutesParams,
} from '../../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.SendConfirm>;

// check TxResendButtons doSpeedUpOrCancelTx() logic
function SendConfirmSpeedUpOrCancel(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    feeInfoError,
    encodedTx,
    sendConfirmParams,
    networkId,
    accountId,
  } = props;
  const route = useRoute<RouteProps>();
  const intl = useIntl();
  const { autoConfirmAfterFeeSaved } = route.params;

  const shouldNavigateToFeeEdit =
    // SpeedUp and Cancel needs feeInfoPayload?.selected
    !autoConfirmAfterFeeSaved && feeInfoPayload?.selected;

  const errorHint = useMemo(() => {
    if (!feeInfoError) {
      return null;
    }

    let message: string | null = null;
    if (feeInfoError instanceof OneKeyError) {
      if (feeInfoError.key !== 'onekey_error') {
        message = intl.formatMessage({
          // @ts-expect-error
          id: feeInfoError.key,
        });
      } else {
        message = feeInfoError.message;
      }
    } else {
      message = feeInfoError.message;
    }
    if (message && message.length > 350) {
      message = `${message.slice(0, 350)}...`;
    }

    return !!message && <Alert alertType="error" title={message} />;
  }, [feeInfoError, intl]);

  return (
    <BaseSendConfirmModal
      {...props}
      autoConfirm={!!autoConfirmAfterFeeSaved}
      hidePrimaryAction
      hideSecondaryAction
    >
      {errorHint}
      <Center w="full" py={16}>
        {!errorHint && <Spinner size="lg" />}
        {shouldNavigateToFeeEdit ? (
          <FeeInfoInputForSpeedUpOrCancel
            networkId={networkId}
            accountId={accountId}
            editable={feeInfoEditable}
            encodedTx={encodedTx}
            feeInfoPayload={feeInfoPayload}
            loading={feeInfoLoading}
            sendConfirmParams={sendConfirmParams}
          />
        ) : null}
      </Center>
    </BaseSendConfirmModal>
  );
}

export { SendConfirmSpeedUpOrCancel };
