import React, { FC, useEffect } from 'react';

import { RouteProp, useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';
import { Center } from 'native-base';
import { useIntl } from 'react-intl';

import { Modal, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected, {
  ValidationFields,
} from '@onekeyhq/kit/src/components/Protected';
import { useToast } from '@onekeyhq/kit/src/hooks/useToast';
import { CreateWalletModalRoutes } from '@onekeyhq/kit/src/routes';
import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

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
    toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
  };

  const startBackupPinVerifyModal = (backupData: string) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.CreateWallet,
      params: {
        screen: CreateWalletModalRoutes.OnekeyLiteBackupPinCodeVerifyModal,
        params: {
          walletId,
          backupData,
          onSuccess: () => {},
        },
      },
    });
  };

  useEffect(() => {
    async function obtainMnemonic() {
      if (!password && !backupType) return;

      try {
        const mnemonic = await backgroundApiProxy.engine.revealHDWalletMnemonic(
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
      <Protected field={ValidationFields.Wallet}>
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
