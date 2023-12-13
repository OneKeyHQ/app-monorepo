import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { Input, Page, YStack } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../../routes/Modal/type';
import { EModalSendRoutes } from '../../router';

import type { IModalSendParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function SendAmountInputContainer() {
  const intl = useIntl();
  const [amount, setAmount] = useState('0.0001');
  const [isLoading, setIsLoading] = useState(false);
  const route =
    useRoute<
      RouteProp<IModalSendParamList, EModalSendRoutes.SendAmountInput>
    >();
  const { networkId, accountId, transfersInfo } = route.params;
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();
  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
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
    setIsLoading(false);

    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendConfirm,
      params: {
        networkId,
        accountId,
        unsignedTxs: [unsignedTx],
        transfersInfo: updatedTransfersInfo,
      },
    });
  }, [accountId, amount, navigation, networkId, transfersInfo]);

  return (
    <Page>
      <Page.Header title={intl.formatMessage({ id: 'form__amount' })} />
      <Page.Body>
        <YStack justifyContent="center">
          <Input
            width="50%"
            value={amount}
            onChange={({ nativeEvent }) => setAmount(nativeEvent.text)}
            autoFocus
          />
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirm={handleConfirm}
        onCancel={() => navigation.popStack()}
        confirmButtonProps={{
          loading: isLoading,
        }}
      />
    </Page>
  );
}

export { SendAmountInputContainer };
