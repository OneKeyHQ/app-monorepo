import { useEffect } from 'react';

import ModalBackcard from '@walletconnect/modal-react-native/lib/module/components/ModalBackcard';
import Toast from '@walletconnect/modal-react-native/lib/module/components/Toast';
import { ModalCtrl } from '@walletconnect/modal-react-native/lib/module/controllers/ModalCtrl';
import { RouterCtrl } from '@walletconnect/modal-react-native/lib/module/controllers/RouterCtrl';
import { useConfigure } from '@walletconnect/modal-react-native/lib/module/hooks/useConfigure';
import { useConnectionHandler } from '@walletconnect/modal-react-native/lib/module/hooks/useConnectionHandler';
import { ModalRouter } from '@walletconnect/modal-react-native/lib/module/modal/wcm-modal-router';
import { StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { useSnapshot } from 'valtio';

import { Dialog, OverlayContainer, Stack } from '@onekeyhq/components';

import type { ConfigCtrlState } from '@walletconnect/modal-react-native/lib/module/controllers/ConfigCtrl';
import type { ThemeCtrlState } from '@walletconnect/modal-react-native/lib/module/controllers/ThemeCtrl';
import type {
  IProviderMetadata,
  ISessionParams,
} from '@walletconnect/modal-react-native/lib/types/coreTypes';

export type IProps = Omit<ConfigCtrlState, 'recentWallet'> &
  ThemeCtrlState & {
    providerMetadata: IProviderMetadata;
    sessionParams?: ISessionParams;
    relayUrl?: string;
    onCopyClipboard?: (value: string) => void;
  };

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
});

export function WalletConnectModalDialog(config: IProps) {
  useConfigure(config);
  useConnectionHandler();
  const { open } = useSnapshot(ModalCtrl.state);
  const { history } = useSnapshot(RouterCtrl.state);

  const onBackButtonPress = () => {
    if (history.length > 1) {
      return RouterCtrl.goBack();
    }
    return ModalCtrl.close();
  };

  return (
    <Modal
      isVisible={open}
      style={styles.modal}
      propagateSwipe
      hideModalContentWhileAnimating
      onBackdropPress={ModalCtrl.close}
      onBackButtonPress={onBackButtonPress}
      useNativeDriver
      statusBarTranslucent
    >
      <OverlayContainer>
        <ModalRouter onCopyClipboard={config.onCopyClipboard} />
        <ModalBackcard onClose={ModalCtrl.close} />
        <Toast />
      </OverlayContainer>
    </Modal>
  );
}
