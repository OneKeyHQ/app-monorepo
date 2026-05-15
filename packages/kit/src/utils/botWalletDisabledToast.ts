import { Toast } from '@onekeyhq/components';

// Centralized messages for "deactivated bot wallet" UI feedback. Disabled
// buttons should still respond to taps with a toast so users get feedback
// instead of a silent dead-click.
// TODO(i18n): replace hardcoded Chinese once locale entries are added.

export type IBotWalletDisabledScene =
  | 'copyAddress'
  | 'receive'
  | 'export'
  | 'beReceiver'
  | 'addMoney'
  | 'bulkCopy'
  | 'referral';

const SCENE_TITLES: Record<IBotWalletDisabledScene, string> = {
  copyAddress: '该钱包已停用，无法复制地址',
  receive: '该钱包已停用，无法接收资产',
  export: '该钱包已停用，无法导出密钥',
  beReceiver: '该地址属于已停用的 Bot 钱包，无法作为接收地址',
  addMoney: '该钱包已停用，无法充值',
  bulkCopy: '该钱包已停用，无法批量复制地址',
  referral: '该钱包已停用，无法绑定邀请码',
};

export function getBotWalletDisabledMessage(scene: IBotWalletDisabledScene) {
  return SCENE_TITLES[scene];
}

export function showBotWalletDisabledToast(scene: IBotWalletDisabledScene) {
  Toast.error({
    title: SCENE_TITLES[scene],
  });
}
