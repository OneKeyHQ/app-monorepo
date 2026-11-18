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

export type ILiteCardErrorAction = 'continue' | 'retry' | 'retryPin' | 'cancel';

enum ENFCEventCode {
  CONNECTED = 1,
  TRANSFERRING_DATA = 2,
  FINISHED = 3,
}

export default function useNFC() {
  const intl = useIntl();
  const willCloseDialogInstance = useRef<IDialogInstance>(undefined);
  const activeCancel = useRef<(() => void) | undefined>(undefined);
  const programmaticDialogs = useRef(new WeakSet<IDialogInstance>());
  const pendingCancels = useRef(new Set<() => void>());
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
      if (!activeCancel.current) return;
      logNFC('connection-event', {
        eventCode: code,
        hasDialogRef: Boolean(willCloseDialogInstance.current),
      });
      if (code !== ENFCEventCode.TRANSFERRING_DATA) {
        if (code === ENFCEventCode.FINISHED) {
          const dialog = willCloseDialogInstance.current;
          setTimeout(() => {
            if (dialog) programmaticDialogs.current.add(dialog);
            void dialog?.close();
          });
        }
        return;
      }
      const dialog = willCloseDialogInstance.current;
      if (dialog) programmaticDialogs.current.add(dialog);
      void dialog?.close();
      logNFC('dialog-show-request');
      const transferDialog = Dialog.show({
        ...closeCallbacks(),
        onClose: (extra) => {
          closeCallbacks().onClose(extra);
          if (!programmaticDialogs.current.has(transferDialog))
            activeCancel.current?.();
        },
        title: intl.formatMessage({
          id: ETranslations.hardware_transferring_data,
        }),
        description: intl.formatMessage({
          id: ETranslations.hardware_device_connected_keep_card_in_place,
        }),
        showFooter: false,
        renderContent: <NFCAnimation state="connecting" height={225} />,
      });
      willCloseDialogInstance.current = transferDialog;
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
  useEffect(
    () => () => {
      for (const cancel of pendingCancels.current) cancel();
      pendingCancels.current.clear();
      void willCloseDialogInstance.current?.close();
    },
    [],
  );
  const checkNFCEnabledPermission = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        if (!liteCardModule) {
          reject(new Error('OneKey Lite is unavailable on Mac Catalyst'));
          return;
        }
        let cancelled = false;
        const cancel = () => {
          cancelled = true;
          pendingCancels.current.delete(cancel);
          reject(new Error('NFC permission check cancelled'));
        };
        pendingCancels.current.add(cancel);
        const context = { operationId: generateUUID(), startedAt: Date.now() };
        logNFC('permission-start', {}, context);
        void LiteCard.checkNFCPermission()
          .then(({ error }) => {
            if (cancelled) return;
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
                  intl.formatMessage({
                    id: ETranslations.settings_turn_on_nfc,
                  }),
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
          })
          .catch(reject)
          .finally(() => pendingCancels.current.delete(cancel));
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
    const dialog = willCloseDialogInstance.current;
    if (dialog) programmaticDialogs.current.add(dialog);
    await dialog?.close();
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
    }: {
      error?: CallbackError;
      cardInfo?: CardInfo;
      lastCardInfo?: CardInfo;
    }) =>
      new Promise<ILiteCardErrorAction>((resolve) => {
        logNFC('error-handler', {
          errorCode: error?.code,
          hasCardInfo: Boolean(cardInfo),
          hasBackup: cardInfo?.hasBackup,
          isNewCard: cardInfo?.isNewCard,
        });
        void hideNFCConnectDialog();
        let settled = false;
        let errorDialog: IDialogInstance | undefined;
        function cancel() {
          finish('cancel');
          void errorDialog?.close();
        }
        function finish(action: ILiteCardErrorAction) {
          if (settled) return;
          settled = true;
          pendingCancels.current.delete(cancel);
          resolve(action);
        }
        pendingCancels.current.add(cancel);
        const onClose = () => finish('cancel');
        const retry = () => {
          logNFC('retry-nfc');
          finish('retry');
        };
        if (
          error?.code === CardErrors.DeviceMismatch ||
          (cardInfo &&
            lastCardInfo &&
            lastCardInfo.serialNum !== cardInfo.serialNum)
        ) {
          errorDialog = Dialog.confirm({
            onClose,
            onConfirm: cancel,
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
        if (error) {
          if (error.code === CardErrors.UserCancel) {
            finish('cancel');
            return;
          }
          switch (error?.code) {
            case CardErrors.InitializedError:
              errorDialog = Dialog.show({
                onClose,
                icon: 'ErrorOutline',
                tone: 'warning',
                title: intl.formatMessage({
                  id: ETranslations.global_unknown_error,
                }),
                description: intl.formatMessage({
                  id: ETranslations.global_unknown_error_retry_message,
                }),
                onConfirmText: intl.formatMessage({
                  id: ETranslations.global_retry,
                }),
                onConfirm: retry,
              });
              break;
            case CardErrors.InterruptError:
              errorDialog = Dialog.show({
                onClose,
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
                onConfirm: retry,
              });
              break;
            case CardErrors.NotInitializedError:
              errorDialog = Dialog.show({
                onClose,
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
                onConfirm: retry,
              });
              break;
            case CardErrors.PasswordWrong:
              errorDialog = Dialog.show({
                onClose,
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
                onConfirm: () => {
                  logNFC('retry-pin');
                  finish('retryPin');
                },
              });
              break;
            case CardErrors.UpperErrorAutoReset:
              errorDialog = Dialog.confirm({
                onClose,
                onConfirm: cancel,
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
              errorDialog = Dialog.show({
                onClose,
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
                onConfirm: retry,
              });
              break;
          }
        } else {
          finish('continue');
        }
      }),
    [intl, hideNFCConnectDialog, logNFC],
  );
  const createNFCConnection = useCallback(
    <T,>(callback: () => Promise<T>) =>
      () =>
        new Promise<T>((resolve, reject) => {
          const context = {
            operationId: generateUUID(),
            startedAt: Date.now(),
          };
          diagnosticContext.current = context;
          let connectionDialog: IDialogInstance | undefined;
          let started = false;
          let nativeStarted = false;
          let settled = false;
          const cancel = () => {
            if (settled) return;
            settled = true;
            pendingCancels.current.delete(cancel);
            if (activeCancel.current === cancel)
              activeCancel.current = undefined;
            if (nativeStarted) LiteCard.cancel();
            void connectionDialog?.close();
            reject(new Error('NFC operation cancelled'));
          };
          pendingCancels.current.add(cancel);
          activeCancel.current = cancel;
          const run = () => {
            if (started || settled) return;
            started = true;
            logNFC('callback-enter', {}, context);
            void Promise.resolve()
              .then(() => {
                if (settled)
                  return Promise.reject(new Error('NFC operation cancelled'));
                nativeStarted = true;
                return callback();
              })
              .then(
                (value) => {
                  if (settled) return;
                  settled = true;
                  pendingCancels.current.delete(cancel);
                  if (activeCancel.current === cancel)
                    activeCancel.current = undefined;
                  resolve(value);
                },
                (error: unknown) => {
                  if (settled) return;
                  settled = true;
                  pendingCancels.current.delete(cancel);
                  const dialog =
                    activeCancel.current === cancel
                      ? willCloseDialogInstance.current
                      : connectionDialog;
                  if (activeCancel.current === cancel)
                    activeCancel.current = undefined;
                  if (dialog) programmaticDialogs.current.add(dialog);
                  void dialog?.close();
                  reject(error);
                },
              );
          };
          const onClose = (extra?: { flag?: string }) => {
            closeCallbacks(context).onClose(extra);
            // Transfer and completion events close running connection dialogs.
            if (
              !connectionDialog ||
              !programmaticDialogs.current.has(connectionDialog)
            )
              cancel();
          };
          logNFC('dialog-show-request', {}, context);
          if (platformEnv.isNativeAndroid) {
            connectionDialog = Dialog.show({
              ...closeCallbacks(context),
              onClose,
              title: intl.formatMessage({
                id: ETranslations.hardware_searching_for_device,
              }),
              description: intl.formatMessage({
                id: ETranslations.hardware_keep_lite_placed_until_found,
              }),
              showFooter: false,
              renderContent: <NFCAnimation state="searching" height={205} />,
            });
            willCloseDialogInstance.current = connectionDialog;
            logNFC('dialog-show-returned', {}, context);
            run();
            return;
          }
          connectionDialog = Dialog.confirm({
            ...closeCallbacks(context),
            onClose,
            title: intl.formatMessage({
              id: ETranslations.hardware_place_onekey_lite_close_to_phone,
            }),
            description: intl.formatMessage({
              id: ETranslations.hardware_place_onekey_lite_close_to_phone_desc,
            }),
            renderContent: <NFCAnimation state="searching" height={205} />,
            onConfirmText: intl.formatMessage({
              id: ETranslations.global_connect,
            }),
            onConfirm: ({ preventClose }) => {
              preventClose();
              logNFC('connect-confirm', {}, context);
              run();
            },
          });
          willCloseDialogInstance.current = connectionDialog;
          logNFC('dialog-show-returned', {}, context);
        }),
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
