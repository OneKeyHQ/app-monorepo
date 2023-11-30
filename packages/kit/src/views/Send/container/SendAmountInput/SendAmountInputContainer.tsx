import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Page, Text } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Root/Modal/Routes';
import { EModalSendRoutes } from '../../types';

import type { IModalSendParamList } from '../../types';
import type { RouteProp } from '@react-navigation/core';

function SendAmountInputContainer() {
  const [amount, setAmount] = useState('0.0001');
  const route =
    useRoute<
      RouteProp<IModalSendParamList, EModalSendRoutes.SendAmountInput>
    >();
  const { transfersInfo } = route.params;
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const handleConfirm = useCallback(async () => {
    const updatedTransfersInfo = transfersInfo.map((transferInfo) => ({
      ...transferInfo,
      amount,
    }));

    const encodedTx = await backgroundApiProxy.serviceSend.buildEncodedTx({
      transfersInfo: updatedTransfersInfo,
    });

    const unsignedTx = await backgroundApiProxy.serviceSend.buildUnsignedTx({
      encodedTx,
    });

    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendConfirm,
      params: {
        unsignedTx,
        transfersInfo: updatedTransfersInfo,
      },
    });
  }, [amount, navigation, transfersInfo]);

  return (
    <Page>
      <Page.Body>
        <Text>SendAmountInputContainer</Text>
      </Page.Body>
      <Page.Footer onConfirm={handleConfirm} />
    </Page>
  );
}

export { SendAmountInputContainer };
