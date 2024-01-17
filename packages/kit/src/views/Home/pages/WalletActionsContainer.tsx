import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EModalSendRoutes } from '../../Send/router';
import { WalletActions } from '../components/WalletActions';

import type { IModalSendParamList } from '../../Send/router';

function WalletActionsContainer() {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const handleOnSend = useCallback(() => {
    // navigation.pushModal(EModalRoutes.SendModal, {
    //   screen: EModalSendRoutes.SendAssetInput,
    //   params: {
    //     networkId: 'evm--1',
    //     accountId: "hd-1--m/44'/60'/0'/0/0",
    //     transfersInfo: [
    //       {
    //         from: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
    //         to: '',
    //         amount: '0',
    //         token: '',
    //       },
    //     ],
    //   },
    // });
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendConfirm,
      params: {
        networkId: 'evm--1',
        accountId: "hd-1--m/44'/60'/0'/0/0",
        transfersInfo: [
          {
            from: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
            to: '0xA9b4d559A98ff47C83B74522b7986146538cD4dF',
            amount: '0.01',
            token: '',
          },
        ],
        unsignedTxs: [
          {
            encodedTx: {
              from: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
              to: '0xA9b4d559A98ff47C83B74522b7986146538cD4dF',
              value: '0x1',
              data: '0x',
            },
          },
        ],
      },
    });
  }, [navigation]);

  const handleOnReceive = useCallback(() => {}, []);

  return <WalletActions onSend={handleOnSend} onReceive={handleOnReceive} />;
}

export { WalletActionsContainer };
