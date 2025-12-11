import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Divider, Toast } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import {
  useAccountSelectorContextData,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { usePrimeAvailable } from '../../../Prime/hooks/usePrimeAvailable';

import { AddHiddenWalletButton } from './AddHiddenWalletButton';
import { BulkCopyAddressesButton } from './BulkCopyAddressesButton';
import { DeviceManagementButton } from './DeviceManagementButton';
import { HdWalletBackupButton } from './HdWalletBackupButton';
import { WalletBoundReferralCodeButton } from './WalletBoundReferralCodeButton';
import { WalletRemoveButton } from './WalletRemoveButton';

// TODO: @zuo Check if wallet is keyless (using custom flag for mock)
function isKeylessWallet(wallet: IDBWallet | undefined): boolean {
  return !!(wallet as IDBWallet & { isKeyless?: boolean })?.isKeyless;
}

function WalletEditButtonView({
  wallet,
  num,
}: {
  wallet?: IDBWallet;
  num?: number;
}) {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: num ?? 0 });

  const { isPrimeAvailable } = usePrimeAvailable();
  const { user } = useOneKeyAuth();

  const isPrimeUser = useMemo(() => {
    return user?.primeSubscription?.isActive && user?.onekeyUserId;
  }, [user]);

  const showDeviceManagementButton = useMemo(() => {
    if (isKeylessWallet(wallet)) return false;
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet]);

  const showAddHiddenWalletButton = useMemo(() => {
    if (isKeylessWallet(wallet)) return false;
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet]);

  const showRemoveWalletButton = useMemo(() => {
    // Keyless wallet can also be removed
    if (isKeylessWallet(wallet)) return true;
    return (
      !wallet?.isMocked &&
      !accountUtils.isOthersWallet({ walletId: wallet?.id || '' })
    );
  }, [wallet]);

  const showRemoveDeviceButton = useMemo(() => {
    if (isKeylessWallet(wallet)) return false;
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet]);

  const showBackupButton = useMemo(() => {
    if (isKeylessWallet(wallet)) return false;
    return accountUtils.isHdWallet({ walletId: wallet?.id });
  }, [wallet]);

  // TODO: @zuo Check if wallet is keyless
  const isKeyless = useMemo(() => isKeylessWallet(wallet), [wallet]);

  const showBulkCopyAddressesButton = useMemo(() => {
    if (isKeylessWallet(wallet)) return false;
    if (!isPrimeAvailable) {
      return false;
    }

    if (wallet?.deprecated || !wallet?.backuped) {
      return false;
    }

    return (
      accountUtils.isHdWallet({ walletId: wallet?.id }) ||
      accountUtils.isHwWallet({ walletId: wallet?.id })
    );
  }, [wallet, isPrimeAvailable]);

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
          <WalletBoundReferralCodeButton
            wallet={wallet}
            onClose={handleActionListClose}
          />

          {/* Keyless wallet: Keys & Recovery */}
          {isKeyless ? (
            <ActionList.Item
              icon="ShieldCheckDoneOutline"
              label="Keys & Recovery"
              onClose={handleActionListClose}
              onPress={() => {
                // TODO: @zuo Implement Keys & Recovery navigation
                Toast.message({
                  title: 'Keys & Recovery',
                  message: 'Coming soon...',
                });
              }}
            />
          ) : null}

          {showBackupButton ? (
            <HdWalletBackupButton
              wallet={wallet}
              onClose={handleActionListClose}
            />
          ) : null}

          {showDeviceManagementButton ? (
            <>
              <DeviceManagementButton
                wallet={wallet}
                onClose={handleActionListClose}
              />
            </>
          ) : null}

          {showBulkCopyAddressesButton ? (
            <BulkCopyAddressesButton
              wallet={wallet}
              networkId={network?.id || ''}
              isPrimeUser={!!isPrimeUser}
              onClose={handleActionListClose}
            />
          ) : null}

          {showAddHiddenWalletButton ? (
            <AddHiddenWalletButton
              wallet={wallet}
              onClose={handleActionListClose}
            />
          ) : null}

          {isKeyless ||
          showDeviceManagementButton ||
          showAddHiddenWalletButton ||
          showBulkCopyAddressesButton ? (
            <Divider mx="$2" my="$1" />
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
      wallet,
      isKeyless,
      showBackupButton,
      showDeviceManagementButton,
      showBulkCopyAddressesButton,
      network?.id,
      isPrimeUser,
      showAddHiddenWalletButton,
      showRemoveWalletButton,
      showRemoveDeviceButton,
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
      floatingPanelProps={{
        width: '$72',
      }}
    />
  );
}

export const WalletEditButton = memo(WalletEditButtonView);
