/* eslint-disable @typescript-eslint/ban-types */
import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Box, Modal } from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../../hooks';
import reducerAccountSelector from '../../../../store/reducers/reducerAccountSelector';
import { ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY } from '../../../Header/AccountSelectorChildren/accountSelectorConsts';
import { LazyDisplayView } from '../../../LazyDisplayView';
import { useAccountSelectorInfo } from '../../hooks/useAccountSelectorInfo';
import SideChainSelector from '../NetworkAccountSelectorModal/SideChainSelector';

const { updateIsOpenDelay, updateIsOpen } = reducerAccountSelector.actions;
// TODO account not found test:
// - first select COSMOS Secret network
// - then select EVM network
// - account not found
function NetworkSelectorModal() {
  const closeModal = useModalClose();
  const { closeWalletSelector } = useNavigationActions();
  // TODO move to hooks
  const { dispatch, serviceNetwork } = backgroundApiProxy;
  // TODO merge logic with packages/kit/src/components/NetworkAccountSelector/NetworkAccountSelectorModal/NetworkAccountSelectorModal.tsx
  const isMountedRef = useRef(false);
  const intl = useIntl();
  useEffect(() => {
    setTimeout(() => {
      isMountedRef.current = true;
      dispatch(updateIsOpen(true));
    }, 50);

    // delay wait drawer closed animation done
    setTimeout(() => {
      dispatch(updateIsOpenDelay(true));
    }, ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY);

    return () => {
      setTimeout(() => {
        isMountedRef.current = false;
        dispatch(updateIsOpen(false));
      }, 50);

      setTimeout(() => {
        dispatch(updateIsOpenDelay(false));
      }, ACCOUNT_SELECTOR_IS_OPEN_REFRESH_DELAY);
    };
  }, [dispatch]);

  const accountSelectorInfo = useAccountSelectorInfo();

  if (!accountSelectorInfo.isOpenDelay && platformEnv.isNativeAndroid) {
    return null;
  }

  return (
    <Modal
      header={intl.formatMessage({ id: 'network__networks' })}
      // TODO loading
      headerDescription={accountSelectorInfo?.selectedNetwork?.name || '-'}
      footer={null}
      staticChildrenProps={{
        flex: 1,
        padding: 0,
      }}
      height="560px"
    >
      <LazyDisplayView delay={0}>
        <Box flex={1} flexDirection="row">
          <SideChainSelector
            fullWidthMode // should be fullWidthMode here
            accountSelectorInfo={accountSelectorInfo}
            onPress={async ({ networkId }) => {
              // TODO merge onPress logic with packages/kit/src/components/NetworkAccountSelector/NetworkAccountSelectorModal/AccountList/ListItem.tsx
              // TODO accountSelectorMode === EAccountSelectorMode.Wallet
              closeModal();
              closeWalletSelector();
              if (networkId) {
                await serviceNetwork.changeActiveNetwork(networkId);
              }
              // appUIEventBus.emit(AppUIEventBusNames.AccountChanged);
            }}
          />
        </Box>
      </LazyDisplayView>
    </Modal>
  );
}

export { NetworkSelectorModal };
