import { useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

export type IExportBotWalletToCliTrigger = (params: {
  walletId: string;
  walletName: string;
}) => Promise<void>;

/**
 * Hook that wires the BotWallet → OneKey CLI (remote-key-protection) export
 * trigger. The flow:
 *
 * 1. Confirm dialog ("远程密钥保护" + "远程一键销毁" copy as required by
 *    AC10/AC11)
 * 2. Open the existing App Transfer pairing flow scoped to the selected
 *    BotWallet
 * 3. Prime Transfer builds and sends the CLI remote-key-protection payload
 *
 * IMPORTANT: BotWallet -> CLI export must go through App Transfer. Do not
 * surface Base64/QR/manual-paste payload UI from this entry point.
 *
 * The "single BotWallet only" condition is enforced by the call site: this
 * hook does not check wallet count itself.
 */
export function useExportBotWalletToCli() {
  const navigation = useAppNavigation();

  const trigger: IExportBotWalletToCliTrigger = useCallback(
    async ({ walletId, walletName }) => {
      Dialog.confirm({
        title: `导出 "${walletName}" 到 OneKey CLI`,
        description: [
          '⚠️ 这是 PoC 阶段的"远程密钥保护"导出方式：',
          '',
          '• 助记词将在本机加密后导出，加密密钥托管在本机的 OneKey 远程密钥服务（127.0.0.1:8787）。',
          '• CLI 端必须每次签名都向密钥服务取钥，离线无法解密。',
          '• 你随时可以通过 CLI 触发"远程一键销毁"，立即让导出的助记词在本机永久不可解。',
          '• 导出数据会通过 App Transfer 加密传输到 OneKey CLI，不需要手动复制 Base64 payload。',
          '',
          '是否继续？',
        ].join('\n'),
        onConfirmText: '继续导出',
        onConfirm: () => {
          navigation.pushModal(EModalRoutes.PrimeModal, {
            screen: EPrimePages.PrimeTransfer,
            params: {
              botWalletId: walletId,
              defaultTab: 'enter-link',
            },
          });
        },
      });
    },
    [navigation],
  );

  return trigger;
}
