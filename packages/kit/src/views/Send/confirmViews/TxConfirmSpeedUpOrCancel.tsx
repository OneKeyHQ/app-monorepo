import React from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';

import { Center, Spinner } from '@onekeyhq/components';

import { FeeInfoInputForSpeedUpOrCancel } from '../FeeInfoInput';
import {
  ITxConfirmViewProps,
  SendConfirmModal,
} from '../SendConfirmViews/SendConfirmModal';
import { SendRoutes, SendRoutesParams } from '../types';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

function TxConfirmSpeedUpOrCancel(props: ITxConfirmViewProps) {
  const { feeInfoPayload, feeInfoLoading, feeInfoEditable, encodedTx } = props;
  const route = useRoute<RouteProps>();
  const { autoConfirmAfterFeeSaved } = route.params;

  return (
    <SendConfirmModal
      {...props}
      autoConfirm={!!autoConfirmAfterFeeSaved}
      hidePrimaryAction
      hideSecondaryAction
    >
      <Center w="full" py={16}>
        <Spinner size="lg" />
        {!autoConfirmAfterFeeSaved ? (
          <FeeInfoInputForSpeedUpOrCancel
            editable={feeInfoEditable}
            encodedTx={encodedTx}
            feeInfoPayload={feeInfoPayload}
            loading={feeInfoLoading}
          />
        ) : null}
      </Center>
    </SendConfirmModal>
  );
}

export { TxConfirmSpeedUpOrCancel };
