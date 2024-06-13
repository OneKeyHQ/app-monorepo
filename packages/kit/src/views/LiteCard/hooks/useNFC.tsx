import { useCallback, useEffect, useMemo, useRef } from 'react';

import LiteCard from '@onekeyfe/react-native-lite-card';
import { CardErrors } from '@onekeyfe/react-native-lite-card/src/types';
import { useIntl } from 'react-intl';
import { Alert } from 'react-native';

import {
  Dialog,
  LottieView,
  RichSizeableText,
  SizableText,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  CallbackError,
  CardInfo,
} from '@onekeyfe/react-native-lite-card/src/types';

enum ENFCEventCode {
  CONNECTED = 1,
  TRANSFERRING_DATA = 2,
  FINISHED = 3,
}

export default function useNFC() {
  const intl = useIntl();
  const willCloseDialogInstance = useRef<IDialogInstance>();
  const handlerNFCConnectStatus = useCallback(
    ({ code }: { code: number }) => {
      if (code !== ENFCEventCode.TRANSFERRING_DATA) {
        if (code === ENFCEventCode.FINISHED) {
          setTimeout(() => {
            void willCloseDialogInstance.current?.close();
          });
        }
        return;
      }
      void willCloseDialogInstance.current?.close?.();
      willCloseDialogInstance.current = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.hardware_transferring_data,
        }),
        description: intl.formatMessage({
          id: ETranslations.hardware_device_connected_keep_card_in_place,
        }),
        showFooter: false,
        renderContent: (
          <LottieView
            source={require('@onekeyhq/kit/assets/animations/connect_onekeylite_connecting.json')}
            height={225}
          />
        ),
      });
    },
    [intl],
  );
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
                title: intl.formatMessage({
                  id: ETranslations.settings_unable_to_connect,
                }),
                description: intl.formatMessage({
                  id: ETranslations.settings_nfc_not_supported,
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_i_got_it,
                }),
              });
              break;
            case CardErrors.NotEnableNFC:
            case CardErrors.NotNFCPermission:
              Alert.alert(
                intl.formatMessage({ id: ETranslations.settings_turn_on_nfc }),
                intl.formatMessage({
                  id: ETranslations.settings_go_to_settings_page_now,
                }),
                [
                  {
                    text: intl.formatMessage({
                      id: ETranslations.global_cancel,
                    }),
                    style: 'cancel',
                  },
                  {
                    text: intl.formatMessage({
                      id: ETranslations.global_confirm,
                    }),
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
    [intl],
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
              title: intl.formatMessage({
                id: ETranslations.hardware_connect_failed,
              }),
              description: intl.formatMessage({
                id: ETranslations.hardware_two_onekey_lite_not_same,
              }),
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_i_got_it,
              }),
            });
            return;
          }
          switch (error?.code) {
            case CardErrors.InterruptError:
              Dialog.show({
                icon: 'ErrorOutline',
                tone: 'destructive',
                title: intl.formatMessage({
                  id: ETranslations.hardware_recovery_interrupted,
                }),
                description: intl.formatMessage({
                  id: ETranslations.hardware_ensure_device_close_to_nfc,
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_retry,
                }),
                onConfirm: retryNFCAction,
              });
              break;
            case CardErrors.NotInitializedError:
              Dialog.show({
                icon: 'ErrorOutline',
                tone: 'warning',
                title: intl.formatMessage({
                  id: ETranslations.hardware_no_backup_inside,
                }),
                description: intl.formatMessage({
                  id: ETranslations.hardware_no_backup_inside_desc,
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_retry,
                }),
                onConfirm: retryNFCAction,
              });
              break;
            case CardErrors.PasswordWrong:
              Dialog.show({
                icon: 'ErrorOutline',
                tone: 'destructive',
                title: intl.formatMessage({
                  id: ETranslations.hardware_onekey_lite_pin_error,
                }),
                renderContent: (
                  <RichSizeableText
                    i18NValues={{
                      red: (text) => (
                        <SizableText color="$textCritical">{text}</SizableText>
                      ),
                      number: `${cardInfo?.pinRetryCount ?? 10}`,
                    }}
                  >
                    {ETranslations.hardware_onekey_lite_pin_error_desc}
                  </RichSizeableText>
                ),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_retry,
                }),
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
                title: intl.formatMessage({
                  id: ETranslations.hardware_onekey_lite_reset,
                }),
                description: intl.formatMessage({
                  id: ETranslations.hardware_pin_incorrect_data_erased,
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_i_got_it,
                }),
              });
              break;
            default:
              Dialog.show({
                icon: 'ErrorOutline',
                tone: 'destructive',
                title: intl.formatMessage({
                  id: ETranslations.hardware_connect_failed,
                }),
                description: intl.formatMessage({
                  id: ETranslations.hardware_ensure_device_close_to_nfc,
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_retry,
                }),
                onConfirm: retryNFCAction,
              });
              break;
          }
          reject();
        } else {
          resolve();
        }
      }),
    [intl, hideNFCConnectDialog],
  );
  const createNFCConnection = useCallback(
    (callback: () => void) => async () => {
      if (platformEnv.isNativeAndroid) {
        willCloseDialogInstance.current = Dialog.show({
          title: intl.formatMessage({
            id: ETranslations.hardware_searching_for_device,
          }),
          description: intl.formatMessage({
            id: ETranslations.hardware_keep_lite_placed_until_found,
          }),
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
        title: intl.formatMessage({
          id: ETranslations.hardware_place_onekey_lite_close_to_phone,
        }),
        description: intl.formatMessage({
          id: ETranslations.hardware_place_onekey_lite_close_to_phone_desc,
        }),
        renderContent: (
          <LottieView
            source={require('@onekeyhq/kit/assets/animations/connect_onekeylite_searching.json')}
            height={205}
          />
        ),
        onConfirmText: intl.formatMessage({ id: ETranslations.global_connect }),
        onConfirm: ({ preventClose }) => {
          preventClose();
          callback();
        },
      });
    },
    [intl],
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
