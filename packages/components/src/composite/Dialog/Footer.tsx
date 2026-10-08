import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { Button, XStack } from '../../primitives';

import { DialogContext } from './context';
import { useDialogInstance } from './hooks';

import type { IDialogFooterProps } from './type';

const mdSizeLargeStyle = { size: 'large' } as any;

// `Dialog.Form` is lazy: it registers its form after the rest of the dialog has
// mounted, and registers a fresh one whenever it remounts. Subscribing once to
// whatever `getForm()` happened to return at mount therefore left `disabledOn`
// watching a form nobody types into, and the confirm button stayed disabled for
// the life of the dialog no matter what the user entered — the lock screen's
// reset dialog could not be confirmed at all (OK-62416). Follow the dialog's
// own registration announcement instead of assuming a single, early form.
const useConfirmButtonDisabled = (
  props: IDialogFooterProps['confirmButtonProps'],
) => {
  const { disabledOn, disabled } = props || {};
  const { getForm } = useDialogInstance();
  const { dialogInstance } = useContext(DialogContext);
  const subscribeFormChange = dialogInstance?.subscribeFormChange;
  const [, updateStatus] = useState(0);
  useEffect(() => {
    if (!disabledOn) {
      return;
    }
    let subscription: { unsubscribe: () => void } | undefined;
    const watchCurrentForm = () => {
      subscription?.unsubscribe();
      subscription = getForm()?.watch(() => {
        updateStatus((i) => i + 1);
      });
    };
    watchCurrentForm();
    const unsubscribeFormChange = subscribeFormChange?.(() => {
      watchCurrentForm();
      // The form this button reads is a different object now, so its value has
      // never been through `disabledOn` — re-evaluate rather than wait for a
      // change `watch` would report.
      updateStatus((i) => i + 1);
    });
    return () => {
      unsubscribeFormChange?.();
      subscription?.unsubscribe();
    };
  }, [disabledOn, getForm, subscribeFormChange]);
  return typeof disabled !== 'undefined' ? disabled : disabledOn?.({ getForm });
};

const useDialogFooterProps = (props: IDialogFooterProps) => {
  const { footerRef, dialogInstance } = useContext(DialogContext);
  const [, setCount] = useState(0);
  // assign notifyUpdate before component mounted
  useMemo(() => {
    footerRef.notifyUpdate = () => setCount((i) => i + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { onConfirm, ...restProps } = footerRef.props || props || {};

  const trackIdValue = (restProps as IDialogFooterProps)?.trackID;

  const handleConfirm = useCallback(async () => {
    if (trackIdValue) {
      defaultLogger.ui.dialog.dialogConfirm({
        trackId: trackIdValue,
      });
    }
    const { close, ref, isExist } = dialogInstance;
    const form = ref.current;
    if (form) {
      const isValidated = await form.trigger();
      if (!isValidated) {
        return;
      }
    }

    const result = onConfirm
      ? await new Promise<boolean>((resolve, reject) => {
          void Promise.resolve(
            onConfirm?.({
              close: (extra) => {
                resolve(false);
                return close(extra);
              },
              preventClose: () => {
                resolve(false);
              },
              getForm: () => dialogInstance.ref.current,
              isExist,
            }),
          )
            .catch((error) => {
              reject(error);
            })
            .then(() => {
              resolve(true);
            });
        })
      : true;
    if (result) {
      void close({ flag: 'confirm' });
    }
  }, [trackIdValue, onConfirm, dialogInstance]);

  return {
    props: restProps,
    onConfirm: handleConfirm,
  };
};

export function Footer(props: IDialogFooterProps) {
  const intl = useIntl();
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { props: restProps, onConfirm } = useDialogFooterProps(props);
  const onConfirmWithLoading = useCallback(async () => {
    try {
      setConfirmLoading(true);
      await onConfirm();
    } finally {
      await timerUtils.wait(300); // wait for animation done
      setConfirmLoading(false);
    }
  }, [onConfirm]);
  const {
    showFooter,
    showCancelButton,
    showConfirmButton,
    cancelButtonProps,
    onConfirmText,
    footerProps,
    confirmButtonProps = {},
    onCancelText,
    tone,
    extraContent,
  } = restProps;
  const { onCancel } = props;
  const { disabled, disabledOn, ...restConfirmButtonProps } =
    confirmButtonProps;
  const confirmButtonDisabled = useConfirmButtonDisabled({
    disabled,
    disabledOn,
  });
  return (
    <>
      {showFooter ? (
        <XStack p="$5" pt="$0" gap="$2.5" {...footerProps}>
          {showCancelButton ? (
            <Button
              flexGrow={1}
              flexBasis={0}
              $md={mdSizeLargeStyle}
              testID="dialog-cancel-btn"
              onPress={onCancel}
              {...cancelButtonProps}
            >
              {onCancelText ||
                intl.formatMessage({ id: ETranslations.global_cancel })}
            </Button>
          ) : null}
          {showConfirmButton ? (
            <Button
              variant={tone === 'destructive' ? 'destructive' : 'primary'}
              flexGrow={1}
              flexBasis={0}
              loading={confirmLoading}
              disabled={confirmButtonDisabled}
              $md={mdSizeLargeStyle}
              testID="dialog-confirm-btn"
              {...restConfirmButtonProps}
              onPress={onConfirmWithLoading}
            >
              {onConfirmText ||
                intl.formatMessage({ id: ETranslations.global_confirm })}
            </Button>
          ) : null}
        </XStack>
      ) : null}
      {extraContent}
    </>
  );
}

function BasicFooterAction({
  showFooter = true,
  footerProps,
  showCancelButton = true,
  showConfirmButton = true,
  cancelButtonProps,
  onConfirm,
  onConfirmText,
  onCancel,
  onCancelText,
  confirmButtonProps = {},
  tone,
  trackID,
  extraContent,
}: IDialogFooterProps) {
  const intl = useIntl();
  const { footerRef } = useContext(DialogContext);
  // assign props before component mounted
  useMemo(() => {
    footerRef.props = {
      showFooter,
      footerProps,
      showCancelButton,
      showConfirmButton,
      cancelButtonProps,
      onConfirm,
      onCancel,
      onConfirmText,
      confirmButtonProps,
      onCancelText,
      trackID,
      tone,
      extraContent,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    footerRef.props = {
      showFooter,
      footerProps,
      showCancelButton,
      showConfirmButton,
      cancelButtonProps,
      onConfirm,
      onCancel,
      onConfirmText:
        onConfirmText ||
        intl.formatMessage({ id: ETranslations.global_confirm }),
      confirmButtonProps,
      onCancelText:
        onCancelText || intl.formatMessage({ id: ETranslations.global_cancel }),
      trackID,
      tone,
      extraContent,
    };
    footerRef.notifyUpdate?.();
  }, [
    showFooter,
    footerProps,
    showCancelButton,
    showConfirmButton,
    cancelButtonProps,
    onConfirm,
    onCancel,
    onConfirmText,
    confirmButtonProps,
    onCancelText,
    trackID,
    tone,
    footerRef,
    intl,
    extraContent,
  ]);
  return null;
}

export const FooterAction = memo(BasicFooterAction);
