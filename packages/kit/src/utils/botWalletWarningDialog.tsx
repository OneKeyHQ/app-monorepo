import { Dialog } from '@onekeyhq/components';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';

// TODO(i18n): replace hardcoded Chinese copy with ETranslations keys
// once locale entries for bot-wallet deactivation warnings are added.

export function showBotWalletDeactivatedWarningDialog(
  signal?: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    let confirming = false;
    let closing = false;
    let shouldClose = false;
    const abortRef: { current?: () => void } = {};
    const dialogRef: { current?: ReturnType<typeof Dialog.show> } = {};
    const safeResolve = (value: boolean) => {
      if (!resolved) {
        resolved = true;
        if (abortRef.current)
          signal?.removeEventListener('abort', abortRef.current);
        resolve(value);
      }
    };
    const closeAfterAbort = () => {
      if (!dialogRef.current || closing || confirming) return;
      closing = true;
      void Promise.resolve()
        .then(() => dialogRef.current?.close())
        .catch(errorToastUtils.showToastOfError);
    };
    const onAbort = () => {
      if (resolved) return;
      shouldClose = true;
      safeResolve(false);
      closeAfterAbort();
    };
    abortRef.current = onAbort;
    if (signal?.aborted) {
      safeResolve(false);
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    dialogRef.current = Dialog.show({
      icon: 'ErrorOutline',
      tone: 'warning',
      title: '该 Bot 钱包已停用',
      description:
        'Bot 钱包停用后无法接收新资产。继续操作可能导致资金转入后无法被该钱包使用，请确认是否继续。',
      onConfirmText: '继续',
      onCancelText: '取消',
      onConfirm: async ({ close }) => {
        if (resolved || confirming) return;
        confirming = true;
        if (!signal) safeResolve(true);
        try {
          await close?.();
          safeResolve(!signal?.aborted);
        } catch (error) {
          safeResolve(false);
          errorToastUtils.showToastOfError(error);
        }
      },
      onCancel: () => {
        safeResolve(false);
      },
      onClose: () => {
        if (!confirming) safeResolve(false);
      },
    });
    if (shouldClose) closeAfterAbort();
  });
}
