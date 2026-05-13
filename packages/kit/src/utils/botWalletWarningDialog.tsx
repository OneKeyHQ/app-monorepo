import { Dialog } from '@onekeyhq/components';

// TODO(i18n): replace hardcoded Chinese copy with ETranslations keys
// once locale entries for bot-wallet deactivation warnings are added.

export function showBotWalletDeactivatedWarningDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (value: boolean) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };

    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'warning',
      title: '该 Bot 钱包已停用',
      description:
        'Bot 钱包停用后无法接收新资产。继续操作可能导致资金转入后无法被该钱包使用，请确认是否继续。',
      onConfirmText: '继续',
      onCancelText: '取消',
      onConfirm: async ({ close }) => {
        safeResolve(true);
        await close?.();
      },
      onCancel: () => {
        safeResolve(false);
      },
      onClose: () => {
        safeResolve(false);
      },
    });
  });
}
