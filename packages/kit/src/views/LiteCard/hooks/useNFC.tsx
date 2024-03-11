import LiteCard from '@onekeyfe/react-native-lite-card';
import { CardErrors } from '@onekeyfe/react-native-lite-card/src/types';
import { Alert } from 'react-native';

import {
  Dialog,
  Divider,
  IconButton,
  Image,
  LottieView,
  SizableText,
  Toast,
  XStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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
        default:
          Dialog.show({
            icon: 'ErrorOutline',
            tone: 'destructive',
            title: 'Connect Failed',
            description: `Make sure the device is close to the phone's NFC module, then try again.`,
            onConfirmText: 'Retry',
          });
          break;
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

export default function useNFC() {
  return {
    checkNFCEnabledPermission,
    handlerLiteCardError,
    showNFCConnectDialog,
  };
}
