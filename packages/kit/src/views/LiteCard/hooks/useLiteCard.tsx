import { useCallback } from 'react';

import LiteCard from '@onekeyfe/react-native-lite-card';
import { CardErrors } from '@onekeyfe/react-native-lite-card/src/types';

import { Checkbox, Dialog, Input, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EOnboardingPages } from '@onekeyhq/kit/src/views/Onboarding/router/type';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ELiteCardRoutes } from '../router/types';

import {
  checkNFCEnabledPermission,
  handlerLiteCardError,
  showNFCConnectDialog,
} from './nfc';
import { showPINFormDialog } from './pin';

import type { CardInfo } from '@onekeyfe/react-native-lite-card/src/types';

function readWalletIdFromSelectWallet(
  navigation: ReturnType<typeof useAppNavigation>,
) {
  return new Promise<string>((resolve) => {
    navigation.pushModal(EModalRoutes.LiteCardModal, {
      screen: ELiteCardRoutes.LiteCardSelectWallet,
      params: {
        onPick: async (wallet) => {
          navigation.popStack();
          resolve(wallet.id);
        },
      },
    });
  });
}

async function readMnemonicWithWalletId(
  _walletId: string | undefined,
  navigation: ReturnType<typeof useAppNavigation>,
) {
  let walletId = _walletId;
  if (!walletId) {
    walletId = await readWalletIdFromSelectWallet(navigation);
  }
  const { password } =
    await backgroundApiProxy.servicePassword.promptPasswordVerify();

  const { mnemonic } =
    await backgroundApiProxy.serviceAccount.getCredentialDecrypt({
      password,
      credentialId: walletId,
    });
  return mnemonic;
}

async function backupWalletWithMnemonic(mnemonic: string, oldCard: CardInfo) {
  const isNewCard = oldCard?.isNewCard;
  const pin = await showPINFormDialog(isNewCard);
  if (isNewCard) {
    await showPINFormDialog(isNewCard, pin);
  }
  await showNFCConnectDialog();
  const encodeMnemonic =
    await backgroundApiProxy.serviceLiteCardMnemonic.encodeMnemonic(mnemonic);
  LiteCard.setMnemonic(
    encodeMnemonic,
    pin,
    async (error, data, newCard) => {
      await handlerLiteCardError(error, data, newCard, oldCard);
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
}

function showBackupOverwrittenDialog() {
  return new Promise<void>((resolve) => {
    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: 'This Device Contains Backup',
      description:
        'If you continue, your previous backup will be fully overwritten and will be lost forever.',
      onConfirmText: 'Overwritten',
      renderContent: (
        <Dialog.Form
          formProps={{
            defaultValues: {},
          }}
        >
          <Dialog.FormField name="agree">
            <Checkbox label="I understand" />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      confirmButtonProps: {
        disabledOn: (params) => {
          const value = params.getForm()?.getValues().agree;
          return !value;
        },
      },
      onConfirm: () => resolve(),
    });
  });
}

function showResetWarningDialog() {
  return new Promise<void>((resolve) => {
    Dialog.show({
      icon: 'GiroCardOutline',
      title: 'Reset OneKey Lite',
      description:
        'Please ensure that you have backed up the recovery phrase before entering "RESET" to confirm, as it will be erased from this OneKey Lite device.',
      renderContent: (
        <Dialog.Form
          formProps={{
            defaultValues: {},
          }}
        >
          <Dialog.FormField name="reset">
            <Input autoFocus flex={1} placeholder="RESET" />
          </Dialog.FormField>
        </Dialog.Form>
      ),
      onConfirmText: 'Reset',
      confirmButtonProps: {
        variant: 'destructive',
        disabledOn: (params) => {
          const value = params.getForm()?.getValues().reset;
          return value !== 'RESET';
        },
      },
      onConfirm: () => resolve(),
    });
  });
}

export default function useLiteCard() {
  const navigation = useAppNavigation();
  const backupWallet = useCallback(
    async (walletId?: string) => {
      await checkNFCEnabledPermission();
      const mnemonic = await readMnemonicWithWalletId(walletId, navigation);
      await showNFCConnectDialog();
      LiteCard.getLiteInfo(async (error, data, oldCard) => {
        await handlerLiteCardError(error, data, oldCard);
        if (!oldCard?.isNewCard) {
          await showBackupOverwrittenDialog();
        }
        await backupWalletWithMnemonic(mnemonic, oldCard);
      });
    },
    [navigation],
  );
  const importWallet = useCallback(async () => {
    await checkNFCEnabledPermission();
    const pin = await showPINFormDialog();
    await showNFCConnectDialog();
    LiteCard.getMnemonicWithPin(pin, async (error, data, cardInfo) => {
      await handlerLiteCardError(error, data, cardInfo);
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
  }, [navigation]);
  const changePIN = useCallback(async () => {
    await checkNFCEnabledPermission();
    const oldPIN = await showPINFormDialog();
    await showNFCConnectDialog();
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
      await handlerLiteCardError(oldError, oldData, oldCard);
      Toast.success({ title: 'Lite PIN Verified' });
      const newPIN = await showPINFormDialog(true);
      await showPINFormDialog(true, newPIN);
      await showNFCConnectDialog();
      LiteCard.changePin(oldPIN, newPIN, async (newError, newData, newCard) => {
        await handlerLiteCardError(newError, newData, newCard, oldCard);
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
  }, []);
  const reset = useCallback(async () => {
    await checkNFCEnabledPermission();
    await showResetWarningDialog();
    await showNFCConnectDialog();
    LiteCard.reset(async (error, data, cardInfo) => {
      await handlerLiteCardError(error, data, cardInfo);
      Dialog.confirm({
        icon: 'CheckRadioOutline',
        tone: 'success',
        title: 'OneKey Lite has been Reset!',
        description:
          'The data on this OneKey Lite has been completely erased, and you can use it as a new OneKey Lite.',
        onConfirmText: 'I Got it',
      });
    });
  }, []);
  return {
    backupWallet,
    importWallet,
    changePIN,
    reset,
  };
}
