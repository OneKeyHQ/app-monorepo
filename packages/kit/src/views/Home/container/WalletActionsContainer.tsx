import { useCallback } from 'react';

import type { IPageNavigationProp } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Root/Modal/Routes';
import { EModalSendRoutes } from '../../Send/types';
import { WalletActions } from '../components/WalletActions';

import type { IModalSendParamList } from '../../Send/types';

function WalletActionsContainer() {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const handleOnSend = useCallback(() => {
    navigation.pushModal(EModalRoutes.SendModal, {
      screen: EModalSendRoutes.SendAddressInput,
    });
  }, [navigation]);

  const handleOnReceive = useCallback(() => {}, []);

  return <WalletActions onSend={handleOnSend} onReceive={handleOnReceive} />;
}

export { WalletActionsContainer };
