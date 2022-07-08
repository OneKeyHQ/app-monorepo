import React from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';

import { Center, Spinner } from '@onekeyhq/components';

import { FeeInfoInputForSpeedUpOrCancel } from '../FeeInfoInput';
import { SendRoutes, SendRoutesParams } from '../types';

import { ITxConfirmViewProps, SendConfirmModal } from './SendConfirmModal';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

function SendConfirmSpeedUpOrCancel(props: ITxConfirmViewProps) {
  const {
    feeInfoPayload,
    feeInfoLoading,
    feeInfoEditable,
    encodedTx,
    sendConfirmParams,
  } = props;
  const route = useRoute<RouteProps>();
  const { autoConfirmAfterFeeSaved } = route.params;

  const shouldNavigateToFeeEdit =
    // SpeedUp and Cancel needs feeInfoPayload?.selected
    !autoConfirmAfterFeeSaved && feeInfoPayload?.selected;

  return (
    <SendConfirmModal
      {...props}
      autoConfirm={!!autoConfirmAfterFeeSaved}
      hidePrimaryAction
      hideSecondaryAction
    >
      <Center w="full" py={16}>
        <Spinner size="lg" />
        {shouldNavigateToFeeEdit ? (
          <FeeInfoInputForSpeedUpOrCancel
            editable={feeInfoEditable}
            encodedTx={encodedTx}
            feeInfoPayload={feeInfoPayload}
            loading={feeInfoLoading}
            sendConfirmParams={sendConfirmParams}
          />
        ) : null}
      </Center>
    </SendConfirmModal>
  );
}

export { SendConfirmSpeedUpOrCancel };
