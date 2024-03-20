import { useCallback, useMemo } from 'react';

import LiteCard from '@onekeyfe/react-native-lite-card';
import { CardErrors } from '@onekeyfe/react-native-lite-card/src/types';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

import useNFC from './useNFC';
import useOperationDialog from './useOperationDialog';
import usePIN from './usePIN';
import useReadMnemonic from './useReadMnemonic';

export default function useLiteCard() {
  const nfc = useNFC();
  const { showPINFormDialog } = usePIN();
  const { readMnemonicWithWalletId } = useReadMnemonic();
  const {
    showBackupOverwrittenDialog,
    showResetWarningDialog,
    showBackupSuccessDialog,
    showChangePINOnNewCardDialog,
    showChangePINSuccessDialog,
    showResetSuccessDialog,
  } = useOperationDialog();

  const navigation = useAppNavigation();
  const backupWallet = useCallback(
    async (walletId?: string) => {
      await nfc.checkNFCEnabledPermission();
      const mnemonic = await readMnemonicWithWalletId(walletId);
      const createLiteInfoConnection = nfc.createNFCConnection(async () => {
        const {
          error: oldError,
          data: oldData,
          cardInfo: oldCard,
        } = await LiteCard.getLiteInfo();
        await nfc.handlerLiteCardError(
          oldError,
          oldData,
          oldCard,
          null,
          createLiteInfoConnection,
        );
        if (!oldCard?.isNewCard) {
          await showBackupOverwrittenDialog();
        }
        const isNewCard = oldCard?.isNewCard;
        const pin = await showPINFormDialog(isNewCard);
        if (isNewCard) {
          await showPINFormDialog(isNewCard, pin);
        }
        const encodeMnemonic =
          await backgroundApiProxy.serviceLiteCardMnemonic.encodeMnemonic(
            mnemonic,
          );

        const createSetMnemonicConnection = nfc.createNFCConnection(
          async () => {
            const {
              error: newError,
              data: newData,
              cardInfo: newCard,
            } = await LiteCard.setMnemonic(encodeMnemonic, pin, !isNewCard);
            await nfc.handlerLiteCardError(
              newError,
              newData,
              newCard,
              oldCard,
              createSetMnemonicConnection,
            );
            showBackupSuccessDialog();
          },
        );
        await createSetMnemonicConnection();
      });
      await createLiteInfoConnection();
    },
    [
      nfc,
      showPINFormDialog,
      readMnemonicWithWalletId,
      showBackupOverwrittenDialog,
      showBackupSuccessDialog,
    ],
  );
  const importWallet = useCallback(async () => {
    await nfc.checkNFCEnabledPermission();
    const pin = await showPINFormDialog();
    const createGetMnemonicConnection = nfc.createNFCConnection(async () => {
      const { error, data, cardInfo } = await LiteCard.getMnemonicWithPin(pin);
      await nfc.handlerLiteCardError(
        error,
        data,
        cardInfo,
        null,
        createGetMnemonicConnection,
      );
      const mnemonicEncoded =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: await backgroundApiProxy.serviceLiteCardMnemonic.decodeMnemonic(
            data ?? '',
          ),
        });
      await backgroundApiProxy.serviceAccount.validateMnemonic(mnemonicEncoded);
      navigation.pushModal(EModalRoutes.OnboardingModal, {
        screen: EOnboardingPages.FinalizeWalletSetup,
        params: { mnemonic: mnemonicEncoded },
      });
    });
    await createGetMnemonicConnection();
  }, [nfc, showPINFormDialog, navigation]);
  const changePIN = useCallback(async () => {
    await nfc.checkNFCEnabledPermission();
    const oldPIN = await showPINFormDialog();
    const createGetMnemonicConnection = nfc.createNFCConnection(async () => {
      const {
        error: oldError,
        data: oldData,
        cardInfo: oldCard,
      } = await LiteCard.getMnemonicWithPin(oldPIN);
      if (oldError?.code === CardErrors.NotInitializedError) {
        await nfc.hideNFCConnectDialog();
        showChangePINOnNewCardDialog();
        return;
      }
      await nfc.handlerLiteCardError(
        oldError,
        oldData,
        oldCard,
        null,
        createGetMnemonicConnection,
      );
      Toast.success({ title: 'Lite PIN Verified' });
      const newPIN = await showPINFormDialog(true);
      await showPINFormDialog(true, newPIN);
      const createChangePINConnection = nfc.createNFCConnection(async () => {
        const {
          error: newError,
          data: newData,
          cardInfo: newCard,
        } = await LiteCard.changePin(oldPIN, newPIN);
        await nfc.handlerLiteCardError(
          newError,
          newData,
          newCard,
          oldCard,
          createChangePINConnection,
        );
        showChangePINSuccessDialog();
      });
      await createChangePINConnection();
    });
    await createGetMnemonicConnection();
  }, [
    nfc,
    showPINFormDialog,
    showChangePINOnNewCardDialog,
    showChangePINSuccessDialog,
  ]);
  const reset = useCallback(async () => {
    await nfc.checkNFCEnabledPermission();
    await showResetWarningDialog();
    const createResetConnection = nfc.createNFCConnection(async () => {
      const { error, data, cardInfo } = await LiteCard.reset();
      await nfc.handlerLiteCardError(
        error,
        data,
        cardInfo,
        null,
        createResetConnection,
      );
      showResetSuccessDialog();
    });
    await createResetConnection();
  }, [nfc, showResetWarningDialog, showResetSuccessDialog]);
  return useMemo(
    () => ({
      backupWallet,
      importWallet,
      changePIN,
      reset,
    }),
    [backupWallet, importWallet, changePIN, reset],
  );
}
