import { useCallback, useMemo } from 'react';

import LiteCard from '@onekeyfe/react-native-lite-card';
import { CardErrors } from '@onekeyfe/react-native-lite-card/src/types';

import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

import useCardPreCheck from './useCardPreCheck';
import useNFC from './useNFC';
import usePIN from './usePIN';
import useReadMnemonic from './useReadMnemonic';

export default function useLiteCard() {
  const nfc = useNFC();
  const { showPINFormDialog } = usePIN();
  const { readMnemonicWithWalletId } = useReadMnemonic();
  const { showBackupOverwrittenDialog, showResetWarningDialog } =
    useCardPreCheck();

  const navigation = useAppNavigation();
  const backupWallet = useCallback(
    async (walletId?: string) => {
      await nfc.checkNFCEnabledPermission();
      const mnemonic = await readMnemonicWithWalletId(walletId);
      await nfc.showNFCConnectDialog();
      LiteCard.getLiteInfo(async (oldError, oldData, oldCard) => {
        await nfc.handlerLiteCardError(oldError, oldData, oldCard);
        if (!oldCard?.isNewCard) {
          await showBackupOverwrittenDialog();
        }
        const isNewCard = oldCard?.isNewCard;
        const pin = await showPINFormDialog(isNewCard);
        if (isNewCard) {
          await showPINFormDialog(isNewCard, pin);
        }
        await nfc.showNFCConnectDialog();
        const encodeMnemonic =
          await backgroundApiProxy.serviceLiteCardMnemonic.encodeMnemonic(
            mnemonic,
          );
        LiteCard.setMnemonic(
          encodeMnemonic,
          pin,
          async (newError, newData, newCard) => {
            await nfc.handlerLiteCardError(newError, newData, newCard, oldCard);
            Dialog.confirm({
              icon: 'CheckRadioOutline',
              tone: 'success',
              title: 'Backup Completed!',
              description:
                'You can recover your wallet using this card and PIN at all times. Remember this PIN as it cannot be recovered if lost, as we do not store any user information.',
              onConfirmText: 'I Got It',
            });
          },
          !isNewCard,
        );
      });
    },
    [
      nfc,
      showPINFormDialog,
      readMnemonicWithWalletId,
      showBackupOverwrittenDialog,
    ],
  );
  const importWallet = useCallback(async () => {
    await nfc.checkNFCEnabledPermission();
    const pin = await showPINFormDialog();
    await nfc.showNFCConnectDialog();
    LiteCard.getMnemonicWithPin(pin, async (error, data, cardInfo) => {
      await nfc.handlerLiteCardError(error, data, cardInfo);
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
  }, [nfc, showPINFormDialog, navigation]);
  const changePIN = useCallback(async () => {
    await nfc.checkNFCEnabledPermission();
    const oldPIN = await showPINFormDialog();
    await nfc.showNFCConnectDialog();
    LiteCard.getMnemonicWithPin(oldPIN, async (oldError, oldData, oldCard) => {
      if (oldError?.code === CardErrors.NotInitializedError) {
        Dialog.show({
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: 'PIN Change Failed',
          description:
            'No need to change the PIN code on this new OneKey Lite card.',
          onConfirmText: 'I Got it',
        });
        return;
      }
      await nfc.handlerLiteCardError(oldError, oldData, oldCard);
      Toast.success({ title: 'Lite PIN Verified' });
      const newPIN = await showPINFormDialog(true);
      await showPINFormDialog(true, newPIN);
      await nfc.showNFCConnectDialog();
      LiteCard.changePin(oldPIN, newPIN, async (newError, newData, newCard) => {
        await nfc.handlerLiteCardError(newError, newData, newCard, oldCard);
        Dialog.confirm({
          icon: 'CheckRadioOutline',
          tone: 'success',
          title: 'OneKey Lite PIN Changed!',
          description:
            "This OneKey Lite's PIN has been changed. Remember this PIN as it cannot be recovered if lost, as we do not store any user information.",
          onConfirmText: 'I Got it',
        });
      });
    });
  }, [nfc, showPINFormDialog]);
  const reset = useCallback(async () => {
    await nfc.checkNFCEnabledPermission();
    await showResetWarningDialog();
    await nfc.showNFCConnectDialog();
    LiteCard.reset(async (error, data, cardInfo) => {
      await nfc.handlerLiteCardError(error, data, cardInfo);
      Dialog.confirm({
        icon: 'CheckRadioOutline',
        tone: 'success',
        title: 'OneKey Lite has been Reset!',
        description:
          'The data on this OneKey Lite has been completely erased, and you can use it as a new OneKey Lite.',
        onConfirmText: 'I Got it',
      });
    });
  }, [nfc, showResetWarningDialog]);
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
