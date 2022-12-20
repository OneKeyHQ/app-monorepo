import { useRoute } from '@react-navigation/native';

import { Center, Spinner } from '@onekeyhq/components';

import { BaseSendConfirmModal } from '../../components/BaseSendConfirmModal';
import { FeeInfoInputForSpeedUpOrCancel } from '../../components/FeeInfoInput';

import type {
  ITxConfirmViewProps,
  SendRoutes,
  SendRoutesParams,
} from '../../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

// check TxResendButtons doSpeedUpOrCancelTx() logic
function SendConfirmSpeedUpOrCancel(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    sendConfirmParams,
    networkId,
    accountId,
  } = props;
  const route = useRoute<RouteProps>();
  const { autoConfirmAfterFeeSaved } = route.params;

  const shouldNavigateToFeeEdit =
    // SpeedUp and Cancel needs feeInfoPayload?.selected
    !autoConfirmAfterFeeSaved && feeInfoPayload?.selected;

  return (
    <BaseSendConfirmModal
      {...props}
      autoConfirm={!!autoConfirmAfterFeeSaved}
      hidePrimaryAction
      hideSecondaryAction
    >
      <Center w="full" py={16}>
        <Spinner size="lg" />
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
