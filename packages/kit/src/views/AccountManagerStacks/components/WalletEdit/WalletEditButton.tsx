import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Divider } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useAccountSelectorContextData,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { BatchCreateAccountButton } from './BatchCreateAccountButton';
import { DeviceManagementButton } from './DeviceManagementButton';
import { HdWalletBackupButton } from './HdWalletBackupButton';
import { WalletBoundReferralCodeButton } from './WalletBoundReferralCodeButton';
import { WalletRemoveButton } from './WalletRemoveButton';

function WalletEditButtonView({
  wallet,
  num,
}: {
  wallet?: IDBWallet;
  num?: number;
}) {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();
  const { activeAccount } = useActiveAccount({ num: num ?? 0 });

  const showDeviceManagementButton = useMemo(() => {
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet]);

  const showRemoveWalletButton = useMemo(() => {
    return (
      !wallet?.isMocked &&
      !accountUtils.isOthersWallet({ walletId: wallet?.id || '' })
    );
  }, [wallet]);

  const showRemoveDeviceButton = useMemo(() => {
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet]);

  const showBoundReferralCodeButton = useMemo(() => {
    if (wallet?.isMocked) {
      return false;
    }
    return (
      accountUtils.isHdWallet({ walletId: wallet?.id }) ||
      (!accountUtils.isHwHiddenWallet({ wallet }) &&
        accountUtils.isHwWallet({ walletId: wallet?.id }))
    );
  }, [wallet]);

  const showBackupButton = useMemo(() => {
    return accountUtils.isHdWallet({ walletId: wallet?.id });
  }, [wallet]);

  // qr wallet can not batch create account
  const canBatchCreateAccount = useMemo(() => {
    if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
      return false;
    }
    if (
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id }) &&
      wallet?.isMocked
    ) {
      return false;
    }
    return (
      accountUtils.isHdWallet({ walletId: wallet?.id }) ||
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet]);

  const estimatedContentHeight = useCallback(async () => {
    let basicHeight = 12;
    if (showDeviceManagementButton) {
      basicHeight += 54;
    }
    if (showRemoveDeviceButton) {
      basicHeight += 44;
    }
    if (showRemoveWalletButton) {
      basicHeight += 44;
    }
    if (showBoundReferralCodeButton) {
      basicHeight += 44;
    }
    if (showBackupButton) {
      basicHeight += 44;
    }
    if (canBatchCreateAccount) {
      basicHeight += 44;
    }
    // const exportKeysVisible = await getExportKeysVisible();
    // if (exportKeysVisible?.showExportPrivateKey) {
    //   basicHeight += 44;
    // }

    // if (exportKeysVisible?.showExportPublicKey) {
    //   basicHeight += 44;
    // }

    // if (exportKeysVisible?.showExportMnemonic) {
    //   basicHeight += 44;
    // }

    // if (
    //   firstIndexedAccount?.id !== indexedAccount?.id ||
    //   firstAccount?.id !== account?.id
    // ) {
    //   basicHeight += 44;
    // }

    // if (showRemoveButton) {
    //   basicHeight += 54;
    // }
    return basicHeight;
  }, [
    showDeviceManagementButton,
    showRemoveDeviceButton,
    showRemoveWalletButton,
    showBoundReferralCodeButton,
    showBackupButton,
    canBatchCreateAccount,
  ]);

  const renderItems = useCallback(
    async ({
      handleActionListClose,
    }: {
      handleActionListClose: () => void;
    }) => {
      if (!config) {
        return null;
      }
      return (
        // fix missing context in popover
        <AccountSelectorProviderMirror enabledNum={[0]} config={config}>
          {showBoundReferralCodeButton ? (
            <WalletBoundReferralCodeButton
              wallet={wallet}
              onClose={handleActionListClose}
            />
          ) : null}

          {showBackupButton ? (
            <HdWalletBackupButton
              wallet={wallet}
              onClose={handleActionListClose}
            />
          ) : null}

          {showDeviceManagementButton ? (
            <DeviceManagementButton
              wallet={wallet}
              onClose={handleActionListClose}
            />
          ) : null}

          {canBatchCreateAccount ? (
            <>
              <BatchCreateAccountButton
                focusedWalletInfo={{
                  wallet: wallet as IDBWallet,
                  device: undefined,
                }}
                activeAccount={activeAccount}
                onClose={handleActionListClose}
              />
              <Divider mx="$2" my="$1" />
            </>
          ) : null}

          {showRemoveWalletButton ? (
            <WalletRemoveButton
              isRemoveToMocked
              wallet={wallet}
              onClose={handleActionListClose}
            />
          ) : null}

          {showRemoveDeviceButton ? (
            <WalletRemoveButton
              wallet={wallet}
              onClose={handleActionListClose}
            />
          ) : null}
        </AccountSelectorProviderMirror>
      );
    },
    [
      config,
      showBoundReferralCodeButton,
      wallet,
      showBackupButton,
      showDeviceManagementButton,
      canBatchCreateAccount,
      showRemoveDeviceButton,
      showRemoveWalletButton,
      activeAccount,
    ],
  );

  if (accountUtils.isOthersWallet({ walletId: wallet?.id || '' })) {
    return null;
  }

  return (
    <ActionList
      title={intl.formatMessage({ id: ETranslations.global_more })}
      renderTrigger={
        <ListItem.IconButton
          testID={`wallet-item-edit-button-${wallet?.name || ''}`}
          icon="DotHorOutline"
        />
      }
      renderItemsAsync={renderItems}
      estimatedContentHeight={estimatedContentHeight}
    />
  );
}

export const WalletEditButton = memo(WalletEditButtonView);
