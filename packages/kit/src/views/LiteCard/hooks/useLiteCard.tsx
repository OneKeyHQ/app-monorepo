import { useCallback, useState } from 'react';

import LiteCard from '@onekeyfe/react-native-lite-card';
import { CardErrors } from '@onekeyfe/react-native-lite-card/src/types';
import { Alert } from 'react-native';

import {
  Checkbox,
  Dialog,
  Divider,
  IconButton,
  Image,
  Input,
  LottieView,
  SizableText,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EOnboardingPages } from '@onekeyhq/kit/src/views/Onboarding/router/type';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { PasswordKeyboard } from '../components/PasswordKeyboard';
import { ELiteCardRoutes } from '../router/types';

import type {
  CallbackError,
  CardInfo,
} from '@onekeyfe/react-native-lite-card/src/types';

function checkNFCEnabledPermission() {
  return new Promise<void>((resolve, reject) => {
    LiteCard.checkNFCPermission((error) => {
      if (!error) {
        resolve();
        return;
      }
      switch (error?.code) {
        case CardErrors.NotExistsNFC:
          Dialog.confirm({
            icon: 'ErrorOutline',
            tone: 'destructive',
            title: 'Unable to Connect',
            description:
              'Your current device does not support NFC, replace it with an NFC-enabled device and try again',
            onConfirmText: 'I Got It',
          });
          break;
        case CardErrors.NotEnableNFC:
        case CardErrors.NotNFCPermission:
          Alert.alert(
            'Turn on NFC and Let "OneKey" Connect Your Hardware Devices',
            'Go to the Settings Page Now?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'OK',
                onPress: () => {
                  LiteCard.intoSetting();
                },
              },
            ],
          );
          break;
        default:
          break;
      }
      reject();
    });
  });
}

function handlerLiteCardError(
  error?: CallbackError,
  data?: any,
  cardInfo?: CardInfo,
  lastCardInfo?: CardInfo,
) {
  return new Promise<void>((resolve, reject) => {
    if (error) {
      if (
        lastCardInfo &&
        lastCardInfo?.serialNum !== cardInfo?.serialNum &&
        error
      ) {
        Dialog.confirm({
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: 'Connect Failed',
          description:
            'The two OneKey Lite used for connection are not the same.',
          onConfirmText: 'I Got it',
        });
        return;
      }
      switch (error?.code) {
        case CardErrors.ConnectionFail:
          Dialog.show({
            icon: 'ErrorOutline',
            tone: 'destructive',
            title: 'Connect Failed',
            description: `Make sure the device is close to the phone's NFC module, then try again.`,
            onConfirmText: 'Retry',
          });
          break;
        case CardErrors.InterruptError:
          Dialog.show({
            icon: 'ErrorOutline',
            tone: 'destructive',
            title: 'Recovery Interrupted',
            description: `Make sure the device is close to the phone's NFC module, then try again.`,
            onConfirmText: 'Retry',
          });
          break;
        case CardErrors.NotInitializedError:
          Dialog.show({
            icon: 'ErrorOutline',
            tone: 'warning',
            title: 'No Backup Inside',
            description:
              'No backup in this OneKey Lite. Replace with another OneKey Lite and retry.',
            onConfirmText: 'Retry',
          });
          break;
        case CardErrors.PasswordWrong:
          Dialog.show({
            icon: 'ErrorOutline',
            tone: 'destructive',
            title: 'OneKey Lite PIN Error',
            renderContent: (
              <SizableText size="$bodyLg" color="$text">
                After{' '}
                <SizableText color="$textCritical">
                  {cardInfo?.pinRetryCount ?? 10}
                </SizableText>{' '}
                more wrong tries, the data on this OneKey Lite will be erased.
              </SizableText>
            ),
            onConfirmText: 'Retry',
          });
          break;
        case CardErrors.UpperErrorAutoReset:
          Dialog.confirm({
            icon: 'ErrorOutline',
            tone: 'destructive',
            title: 'OneKey Lite has been Reset',
            description:
              'The PIN code has been entered incorrectly over 10 times. To prevent unauthorized access to the backup data, the data on this device has been erased.',
            onConfirmText: 'I Got it',
          });
          break;
        default: {
          break;
        }
      }
      reject();
    } else {
      resolve();
    }
  });
}

function showNFCConnectDialog() {
  return new Promise<void>((resolve) => {
    if (platformEnv.isNativeAndroid) {
      const searchDialog = Dialog.show({
        title: 'Searching for device...',
        description:
          'Please keep Lite placed with the phone until the device is found.',
        showFooter: false,
        renderContent: (
          <LottieView
            source={require('@onekeyhq/kit/assets/animations/connect_onekeylite_searching.json')}
            height={205}
          />
        ),
      });
      let transferDialog: { close: () => void };
      const handlerNFCConnectStatus = ({ code }: { code: number }) => {
        if (code !== 2) {
          if (code === 3) {
            setTimeout(() => {
              transferDialog?.close();
            });
            LiteCard.removeConnectListeners();
          }
          return;
        }
        void searchDialog.close();
        transferDialog = Dialog.show({
          title: 'Transferring Data...',
          description:
            'The device is connected, please keep the card in place and do not move it.',
          showFooter: false,
          renderContent: (
            <LottieView
              source={require('@onekeyhq/kit/assets/animations/connect_onekeylite_connecting.json')}
              height={225}
            />
          ),
        });
      };
      LiteCard.addConnectListener(handlerNFCConnectStatus);
      resolve();
      return;
    }
    const toast = Toast.show({
      children: (
        <XStack
          p="$3"
          $md={{
            maxWidth: '$80',
          }}
          bg="$bgSubdued"
          alignItems="center"
          borderRadius="$2.5"
          space="$2"
        >
          <Image
            source={require('@onekeyhq/kit/assets/litecard/onekey-lite.png')}
            width={60}
            height={50}
          />
          <Divider vertical h={72} />
          <SizableText flex={1} size="$bodyLg">
            Place Your Onekey Lite Close to the Back of Here
          </SizableText>
          <Toast.Close>
            <IconButton icon="ArrowTopLeftOutline" />
          </Toast.Close>
        </XStack>
      ),
    });
    Dialog.confirm({
      title: 'Place OneKey Lite Close to the Phone',
      description:
        'Place the Lite and phone as shown in the figure below, then click "connect.”',
      renderContent: (
        <LottieView
          source={require('@onekeyhq/kit/assets/animations/connect_onekeylite_searching.json')}
          height={205}
        />
      ),
      onClose: toast.close,
      onConfirmText: 'Connect',
      onConfirm: () => {
        void toast.close();
        resolve();
      },
    });
  });
}

function PasswordKeyboardDescription({
  description,
  shouldConfirmPassword,
}: {
  description?: string;
  shouldConfirmPassword?: string;
}) {
  const [password, setPassword] = useState('');
  const showError =
    shouldConfirmPassword &&
    password.length === shouldConfirmPassword.length &&
    shouldConfirmPassword !== password;
  return (
    <Dialog.Form
      formProps={{
        defaultValues: {},
      }}
    >
      <SizableText size="$bodyLg" color={showError ? '$textCritical' : '$text'}>
        {showError
          ? 'The entered PINs do not match. Please reconfirm.'
          : description}
      </SizableText>
      <Dialog.FormField name="password">
        <PasswordKeyboard
          onChange={(value) => {
            setPassword(value);
            return value;
          }}
        />
      </Dialog.FormField>
    </Dialog.Form>
  );
}

function showPINFormDialog(
  isSetNewPassword?: boolean,
  shouldConfirmPassword?: string,
) {
  const config = {
    title: 'Enter OneKey Lite PIN',
    description:
      'OneKey Lite PIN is a 6-digit number and cannot be retrieved if forgotten, as we do not store any user information.',
  };
  if (isSetNewPassword) {
    config.title = 'Set OneKey Lite PIN';
    config.description = 'Set a 6-digit PIN for your OneKey Lite. ';
    if (shouldConfirmPassword) {
      config.title = 'Confirm OneKey Lite PIN';
      config.description = 'Please re-enter the OneKey Lite LIN you just set. ';
    }
  }
  return new Promise<string>((resolve) => {
    Dialog.confirm({
      icon: 'GiroCardOutline',
      title: config.title,
      renderContent: (
        <PasswordKeyboardDescription
          shouldConfirmPassword={shouldConfirmPassword}
          description={config.description}
        />
      ),
      confirmButtonProps: {
        disabledOn: (dialogInstance) => {
          const value = dialogInstance.getForm()?.getValues()
            .password as string;
          const disable = !(value?.length >= 6);
          if (!disable && shouldConfirmPassword) {
            return shouldConfirmPassword !== value;
          }
          return disable;
        },
      },
      onConfirm: (dialogInstance) => {
        const pin = dialogInstance.getForm()?.getValues().password;
        resolve(pin);
      },
    });
  });
}

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
