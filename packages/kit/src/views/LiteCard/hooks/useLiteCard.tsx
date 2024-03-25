import { useCallback, useMemo, useRef } from 'react';

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
  const pin = useRef('');

  const navigation = useAppNavigation();
  const backupWallet = useCallback(
    async (walletId?: string) => {
      await nfc.checkNFCEnabledPermission();
      const mnemonic = await readMnemonicWithWalletId(walletId);
      const createLiteInfoConnection = nfc.createNFCConnection(async () => {
        const { error: oldError, cardInfo: oldCard } =
          await LiteCard.getLiteInfo();
        await nfc.handlerLiteCardError({
          error: oldError,
          cardInfo: oldCard,
          retryNFCAction: createLiteInfoConnection,
        });
        if (!oldCard?.isNewCard) {
          await showBackupOverwrittenDialog();
        }
        const isNewCard = oldCard?.isNewCard;
        const createPINConnection = async () => {
          pin.current = await showPINFormDialog(isNewCard);
        };
        await createPINConnection();
        if (isNewCard) {
          await showPINFormDialog(isNewCard, pin.current);
        }
        const encodeMnemonic =
          await backgroundApiProxy.serviceLiteCardMnemonic.encodeMnemonic(
            mnemonic,
          );

        const createSetMnemonicConnection = nfc.createNFCConnection(
          async () => {
            const { error: newError, cardInfo: newCard } =
              await LiteCard.setMnemonic(
                encodeMnemonic,
                pin.current,
                !isNewCard,
              );
            await nfc.handlerLiteCardError({
              error: newError,
              cardInfo: newCard,
              lastCardInfo: oldCard,
              retryNFCAction: createSetMnemonicConnection,
              retryPINAction: createPINConnection,
            });
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
    const createPINConnection = async () => {
      pin.current = await showPINFormDialog();
    };
    await createPINConnection();
    const createGetMnemonicConnection = nfc.createNFCConnection(async () => {
      const { error, data, cardInfo } = await LiteCard.getMnemonicWithPin(
        pin.current,
      );
      await nfc.handlerLiteCardError({
        error,
        cardInfo,
        retryNFCAction: createGetMnemonicConnection,
        retryPINAction: createPINConnection,
      });
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
    const createPINConnection = async () => {
      pin.current = await showPINFormDialog();
    };
    await createPINConnection();
    const createGetMnemonicConnection = nfc.createNFCConnection(async () => {
      const { error: oldError, cardInfo: oldCard } =
        await LiteCard.getMnemonicWithPin(pin.current);
      if (oldError?.code === CardErrors.NotInitializedError) {
        await nfc.hideNFCConnectDialog();
        showChangePINOnNewCardDialog();
        return;
      }
      await nfc.handlerLiteCardError({
        error: oldError,
        cardInfo: oldCard,
        retryNFCAction: createGetMnemonicConnection,
        retryPINAction: createPINConnection,
      });
      Toast.success({ title: 'Lite PIN Verified' });
      const newPIN = await showPINFormDialog(true);
      await showPINFormDialog(true, newPIN);
      const createChangePINConnection = nfc.createNFCConnection(async () => {
        const { error: newError, cardInfo: newCard } = await LiteCard.changePin(
          pin.current,
          newPIN,
        );
        await nfc.handlerLiteCardError({
          error: newError,
          cardInfo: newCard,
          lastCardInfo: oldCard,
          retryNFCAction: createChangePINConnection,
          retryPINAction: createPINConnection,
        });
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
      const { error, cardInfo } = await LiteCard.reset();
      await nfc.handlerLiteCardError({
        error,
        cardInfo,
        retryNFCAction: createResetConnection,
      });
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
