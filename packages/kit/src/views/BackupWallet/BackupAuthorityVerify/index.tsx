import React, { FC, useEffect } from 'react';

import { RouteProp, useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { Center } from 'native-base';
import { useIntl } from 'react-intl';

import { Modal, Spinner } from '@onekeyhq/components';
import Protected from '@onekeyhq/kit/src/components/Protected';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { OnekeyLiteModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareOnekeyLite';

import engine from '../../../engine/EngineProvider';
import { useToast } from '../../../hooks/useToast';
import { ModalRoutes, RootRoutes } from '../../../routes/types';
import { BackupType } from '../types';

type BackupWalletAuthorityVerifyDoneProps = {
  password: string;
  walletId: string;
  backupType: BackupType;
};

const BackupWalletAuthorityVerifyDone: FC<
  BackupWalletAuthorityVerifyDoneProps
> = ({ password, walletId, backupType }) => {
  const intl = useIntl();
  const toast = useToast();
  const navigation = useNavigation();

  const showError = function () {
    toast.info(intl.formatMessage({ id: 'msg__unknown_error' }));
  };

  const startBackupModal = (
    inputPwd: string,
    backupData: string,
    callBack: () => void,
  ) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.OnekeyLite,
      params: {
        screen: OnekeyLiteModalRoutes.OnekeyLiteBackupModal,
        params: {
          walletId,
          pwd: inputPwd,
          backupData,
          onRetry: () => {
            callBack?.();
          },
          onSuccess: () => {},
        },
      },
    });
  };

  const startBackupPinVerifyModal = (backupData: string) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.OnekeyLite,
      params: {
        screen: OnekeyLiteModalRoutes.OnekeyLitePinCodeVerifyModal,
        params: {
          callBack: (inputPwd) => {
            startBackupModal(inputPwd, backupData, () => {
              startBackupPinVerifyModal(backupData);
            });
            return true;
          },
        },
      },
    });
  };

  useEffect(() => {
    async function obtainMnemonic() {
      if (!password && !backupType) return;

      try {
        const mnemonic = await engine.revealHDWalletMnemonic(
          walletId,
          password,
        );

        if (navigation.canGoBack()) {
          navigation.goBack?.();
        }

        switch (backupType) {
          case 'OnekeyLite':
            startBackupPinVerifyModal(mnemonic);
            break;
          case 'Manual':
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.BackupWallet,
              params: {
                screen: BackupWalletModalRoutes.BackupWalletManualHintModal,
                params: {
                  backup: mnemonic,
                  walletId,
                },
              },
            });
            break;
          case 'showMnemonics':
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.WalletViewMnemonics,
              params: {
                screen: BackupWalletModalRoutes.BackupShowMnemonicsModal,
                params: {
                  backup: mnemonic,
                  readOnly: true,
                  walletId,
                },
              },
            });
            break;
          default:
            break;
        }
      } catch (e) {
        // 未知错误
        console.error(e);

        showError();

        if (navigation.canGoBack()) {
          navigation.goBack?.();
        }
      }
    }

    obtainMnemonic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backupType, intl, navigation, password, walletId]);

  return (
    <Center h="full" w="full">
      <Spinner size="lg" />
    </Center>
  );
};

type RouteProps = RouteProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal
>;

const BackupAuthorityWalletVerifyView: FC = () => {
  const { walletId, backupType } = useRoute<RouteProps>().params;

  return (
    <Modal footer={null}>
      <Protected>
        {(password) => (
          <BackupWalletAuthorityVerifyDone
            walletId={walletId}
            password={password}
            backupType={backupType}
          />
        )}
      </Protected>
    </Modal>
  );
};

export default BackupAuthorityWalletVerifyView;
