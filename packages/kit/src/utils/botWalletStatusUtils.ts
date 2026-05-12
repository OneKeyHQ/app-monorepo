import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export type IBotWalletNameBadge = {
  key: 'deactivated';
  label: '已停用';
  tone: 'subdued' | 'caution';
};

export function getBotWalletNameBadges({
  isBotWallet,
  isBotWalletDeactivated,
}: {
  isBotWallet: boolean;
  isBotWalletDeactivated: boolean;
}): IBotWalletNameBadge[] {
  if (!isBotWallet || !isBotWalletDeactivated) {
    return [];
  }

  return [
    {
      key: 'deactivated',
      label: '已停用',
      tone: 'caution',
    },
  ];
}

export function shouldBlockBotWalletReceive({
  isBotWallet,
  isBotWalletDeactivated,
}: {
  isBotWallet: boolean;
  isBotWalletDeactivated: boolean;
}) {
  return isBotWallet && isBotWalletDeactivated;
}

export function shouldHideBotWalletExport({
  isBotWallet,
  isBotWalletDeactivated,
}: {
  isBotWallet: boolean;
  isBotWalletDeactivated: boolean;
}) {
  return isBotWallet && isBotWalletDeactivated;
}

export function shouldBlockBotWalletCopyAddress({
  isBotWallet,
  isBotWalletDeactivated,
}: {
  isBotWallet: boolean;
  isBotWalletDeactivated: boolean;
}) {
  return isBotWallet && isBotWalletDeactivated;
}

export function shouldBlockBotWalletBeReceiver({
  isBotWallet,
  isBotWalletDeactivated,
}: {
  isBotWallet: boolean;
  isBotWalletDeactivated: boolean;
}) {
  return isBotWallet && isBotWalletDeactivated;
}

export function shouldBlockBotWalletReferralAddressDisplay({
  isBotWallet,
  isBotWalletDeactivated,
}: {
  isBotWallet: boolean;
  isBotWalletDeactivated: boolean;
}) {
  return isBotWallet && isBotWalletDeactivated;
}

export function shouldWarnBotWalletInteract({
  isBotWallet,
  isBotWalletDeactivated,
}: {
  isBotWallet: boolean;
  isBotWalletDeactivated: boolean;
}) {
  return isBotWallet && isBotWalletDeactivated;
}

export function shouldHideBotWalletMnemonicBackupEntry({
  isBotWallet,
}: {
  isBotWallet: boolean;
}) {
  return isBotWallet;
}

export function shouldShowMnemonicBackupEntryForWallet({
  walletId,
  isKeylessWallet,
}: {
  walletId?: string;
  isKeylessWallet?: boolean;
}) {
  if (isKeylessWallet) {
    return false;
  }

  return (
    accountUtils.isHdWallet({ walletId }) &&
    !shouldHideBotWalletMnemonicBackupEntry({
      isBotWallet: accountUtils.isBotWallet({ walletId }),
    })
  );
}
