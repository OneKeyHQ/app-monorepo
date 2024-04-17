import { useCallback, useEffect, useMemo, useRef } from 'react';

import LiteCard from '@onekeyfe/react-native-lite-card';
import { CardErrors } from '@onekeyfe/react-native-lite-card/src/types';
import { Alert } from 'react-native';

import { Dialog, LottieView, SizableText } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  CallbackError,
  CardInfo,
} from '@onekeyfe/react-native-lite-card/src/types';

export default function useNFC() {
  const willCloseDialogInstance = useRef<IDialogInstance>();
  const handlerNFCConnectStatus = useCallback(({ code }: { code: number }) => {
    if (code !== 2) {
      if (code === 3) {
        setTimeout(() => {
          void willCloseDialogInstance.current?.close();
        });
      }
      return;
    }
    void willCloseDialogInstance.current?.close?.();
    willCloseDialogInstance.current = Dialog.show({
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
  }, []);
  useEffect(() => {
    if (!platformEnv.isNativeAndroid) {
      return;
    }
    LiteCard.addConnectListener(handlerNFCConnectStatus);
    return () => LiteCard.removeConnectListeners();
  }, [handlerNFCConnectStatus]);
  const checkNFCEnabledPermission = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        void LiteCard.checkNFCPermission().then(({ error }) => {
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
      }),
    [],
  );
  const hideNFCConnectDialog = useCallback(async () => {
    await willCloseDialogInstance?.current?.close?.();
  }, [willCloseDialogInstance]);
  const handlerLiteCardError = useCallback(
    ({
      error,
      cardInfo,
      lastCardInfo,
      retryNFCAction,
      retryPINAction,
    }: {
      error?: CallbackError;
      cardInfo?: CardInfo;
      lastCardInfo?: CardInfo;
      retryNFCAction?: () => Promise<void>;
      retryPINAction?: () => Promise<void>;
    }) =>
      new Promise<void>((resolve, reject) => {
        void hideNFCConnectDialog();
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
                onConfirm: retryNFCAction,
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
                onConfirm: retryNFCAction,
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
                    more wrong tries, the data on this OneKey Lite will be
                    erased.
                  </SizableText>
                ),
                onConfirmText: 'Retry',
                onConfirm: async (dialogInstance) => {
                  void dialogInstance.close();
                  await retryPINAction?.();
                  await retryNFCAction?.();
                },
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
                onConfirm: retryNFCAction,
              });
              break;
          }
          reject();
        } else {
          resolve();
        }
      }),
    [hideNFCConnectDialog],
  );
  const createNFCConnection = useCallback(
    (callback: () => void) => async () => {
      if (platformEnv.isNativeAndroid) {
        willCloseDialogInstance.current = Dialog.show({
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
        callback();
        return;
      }
      willCloseDialogInstance.current = Dialog.confirm({
        title: 'Place OneKey Lite Close to the Phone',
        description:
          'Place the Lite and phone as shown in the figure below, then click "connect.”',
        renderContent: (
          <LottieView
            source={require('@onekeyhq/kit/assets/animations/connect_onekeylite_searching.json')}
            height={205}
          />
        ),
        onConfirmText: 'Connect',
        onConfirm: ({ preventClose }) => {
          preventClose();
          callback();
        },
      });
    },
    [],
  );
  return useMemo(
    () => ({
      checkNFCEnabledPermission,
      handlerLiteCardError,
      createNFCConnection,
      hideNFCConnectDialog,
    }),
    [
      checkNFCEnabledPermission,
      handlerLiteCardError,
      createNFCConnection,
      hideNFCConnectDialog,
    ],
  );
}
