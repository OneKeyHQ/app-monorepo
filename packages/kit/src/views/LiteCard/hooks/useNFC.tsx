import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';
import { Alert } from 'react-native';

import {
  Dialog,
  RichSizeableText,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ILiteCardDiagnostic } from '@onekeyhq/shared/src/logger/scopes/hardware/scenes/litecard';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import type { LiteCardNFCAnimation } from '../components/LiteCardNFCAnimation';
import type { CallbackError, CardInfo } from '@onekeyfe/react-native-lite-card';

type ILiteCardModule = typeof import('@onekeyfe/react-native-lite-card');

const liteCardModule: ILiteCardModule | undefined =
  platformEnv.isNativeIOSMacCatalyst
    ? undefined
    : (require('@onekeyfe/react-native-lite-card') as ILiteCardModule);

export const LiteCard = liteCardModule?.default as ILiteCardModule['default'];
export const CardErrors =
  liteCardModule?.CardErrors as ILiteCardModule['CardErrors'];

// NFC dialog animations are not needed by the Home backup entry at startup.
const LazyLiteCardNFCAnimation = LazyLoad<
  ComponentProps<typeof LiteCardNFCAnimation>
>(
  () =>
    import('../components/LiteCardNFCAnimation').then((module) => ({
      default: module.LiteCardNFCAnimation,
    })),
  undefined,
  null,
);

function NFCAnimation(props: ComponentProps<typeof LiteCardNFCAnimation>) {
  // Preserve dialog geometry while the animation segment loads.
  return (
    <Stack height={props.height}>
      <LazyLiteCardNFCAnimation {...props} />
    </Stack>
  );
}

enum ENFCEventCode {
  CONNECTED = 1,
  TRANSFERRING_DATA = 2,
  FINISHED = 3,
}

export default function useNFC() {
  const intl = useIntl();
  const willCloseDialogInstance = useRef<IDialogInstance>(undefined);
  const diagnosticContext = useRef<{ operationId: string; startedAt: number }>(
    undefined,
  );
  const logNFC = useCallback(
    (
      phase: ILiteCardDiagnostic['phase'],
      fields: Partial<ILiteCardDiagnostic> = {},
      context = diagnosticContext.current,
    ) => {
      defaultLogger.hardware.liteCard.diagnostic({
        ...fields,
        operation: 'nfc',
        phase,
        operationId: context?.operationId ?? '',
        elapsedMs: context ? Date.now() - context.startedAt : undefined,
      });
    },
    [],
  );
  const closeCallbacks = useCallback(
    (context = diagnosticContext.current) => ({
      onCloseStart: () => logNFC('dialog-close-start', {}, context),
      onClose: (extra?: { flag?: string }) =>
        logNFC(
          'dialog-close',
          {
            closeReason:
              extra?.flag === 'confirm' || extra?.flag === 'cancel'
                ? extra.flag
                : 'other',
          },
          context,
        ),
    }),
    [logNFC],
  );
  const handlerNFCConnectStatus = useCallback(
    ({ code }: { code: number }) => {
      logNFC('connection-event', {
        eventCode: code,
        hasDialogRef: Boolean(willCloseDialogInstance.current),
      });
      if (code !== ENFCEventCode.TRANSFERRING_DATA) {
        if (code === ENFCEventCode.FINISHED) {
          setTimeout(() => {
            void willCloseDialogInstance.current?.close();
          });
        }
        return;
      }
      void willCloseDialogInstance.current?.close?.();
      logNFC('dialog-show-request');
      willCloseDialogInstance.current = Dialog.show({
        ...closeCallbacks(),
        title: intl.formatMessage({
          id: ETranslations.hardware_transferring_data,
        }),
        description: intl.formatMessage({
          id: ETranslations.hardware_device_connected_keep_card_in_place,
        }),
        showFooter: false,
        renderContent: <NFCAnimation state="connecting" height={225} />,
      });
      logNFC('dialog-show-returned');
    },
    [intl, logNFC, closeCallbacks],
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
        if (!liteCardModule) {
          reject(new Error('OneKey Lite is unavailable on Mac Catalyst'));
          return;
        }
        const context = { operationId: generateUUID(), startedAt: Date.now() };
        logNFC('permission-start', {}, context);
        void LiteCard.checkNFCPermission().then(({ error }) => {
          logNFC(
            'permission-result',
            {
              errorCode: error?.code,
              isSuccess: !error,
            },
            context,
          );
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
          reject(new Error('NFC permission check failed'));
        });
      }),
    [intl, logNFC],
  );
  const hideNFCConnectDialog = useCallback(async () => {
    const context = diagnosticContext.current;
    logNFC(
      'hide-request',
      { hasDialogRef: Boolean(willCloseDialogInstance.current) },
      context,
    );
    await willCloseDialogInstance?.current?.close?.();
    logNFC(
      'hide-settled',
      { hasDialogRef: Boolean(willCloseDialogInstance.current) },
      context,
    );
  }, [willCloseDialogInstance, logNFC]);
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
        logNFC('error-handler', {
          errorCode: error?.code,
          hasCardInfo: Boolean(cardInfo),
          hasBackup: cardInfo?.hasBackup,
          isNewCard: cardInfo?.isNewCard,
        });
        void hideNFCConnectDialog();
        if (error) {
          if (
            cardInfo &&
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
                onConfirm: retryNFCAction
                  ? () => {
                      logNFC('retry-nfc');
                      return retryNFCAction();
                    }
                  : undefined,
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
                onConfirm: retryNFCAction
                  ? () => {
                      logNFC('retry-nfc');
                      return retryNFCAction();
                    }
                  : undefined,
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
                  logNFC('retry-pin');
                  await retryPINAction?.();
                  logNFC('retry-nfc');
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
                onConfirm: retryNFCAction
                  ? () => {
                      logNFC('retry-nfc');
                      return retryNFCAction();
                    }
                  : undefined,
              });
              break;
          }
          reject(new Error('NFC error handler failed'));
        } else {
          resolve();
        }
      }),
    [intl, hideNFCConnectDialog, logNFC],
  );
  const createNFCConnection = useCallback(
    (callback: () => void) => async () => {
      const context = { operationId: generateUUID(), startedAt: Date.now() };
      diagnosticContext.current = context;
      logNFC('dialog-show-request', {}, context);
      if (platformEnv.isNativeAndroid) {
        willCloseDialogInstance.current = Dialog.show({
          ...closeCallbacks(context),
          title: intl.formatMessage({
            id: ETranslations.hardware_searching_for_device,
          }),
          description: intl.formatMessage({
            id: ETranslations.hardware_keep_lite_placed_until_found,
          }),
          showFooter: false,
          renderContent: <NFCAnimation state="searching" height={205} />,
        });
        logNFC('dialog-show-returned', {}, context);
        logNFC('callback-enter', {}, context);
        callback();
        return;
      }
      willCloseDialogInstance.current = Dialog.confirm({
        ...closeCallbacks(context),
        title: intl.formatMessage({
          id: ETranslations.hardware_place_onekey_lite_close_to_phone,
        }),
        description: intl.formatMessage({
          id: ETranslations.hardware_place_onekey_lite_close_to_phone_desc,
        }),
        renderContent: <NFCAnimation state="searching" height={205} />,
        onConfirmText: intl.formatMessage({ id: ETranslations.global_connect }),
        onConfirm: ({ preventClose }) => {
          logNFC('connect-confirm', {}, context);
          preventClose();
          logNFC('callback-enter', {}, context);
          callback();
        },
      });
      logNFC('dialog-show-returned', {}, context);
    },
    [intl, logNFC, closeCallbacks],
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
