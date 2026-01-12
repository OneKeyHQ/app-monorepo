import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, Divider } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useKeylessWallet } from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useAccountSelectorContextData,
  useActiveAccount,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingV2OneKeyIDLoginMode } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { usePrimeAvailable } from '../../../Prime/hooks/usePrimeAvailable';

import { AddHiddenWalletButton } from './AddHiddenWalletButton';
import { BulkCopyAddressesButton } from './BulkCopyAddressesButton';
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
  const {
    activeAccount: { network },
  } = useActiveAccount({ num: num ?? 0 });
  const isKeyless = useMemo(() => wallet?.isKeyless, [wallet]);

  const { isPrimeAvailable } = usePrimeAvailable();
  const { user } = useOneKeyAuth();
  const { goToOneKeyIDLoginPageForKeylessWallet } = useKeylessWallet();

  const [isResetPinLoading, setIsResetPinLoading] = useState(false);
  const [isVerifyPinLoading, setIsVerifyPinLoading] = useState(false);

  const isPrimeUser = useMemo(() => {
    return user?.primeSubscription?.isActive && user?.onekeyUserId;
  }, [user]);

  const showDeviceManagementButton = useMemo(() => {
    if (isKeyless) return false;
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet, isKeyless]);

  const showAddHiddenWalletButton = useMemo(() => {
    if (isKeyless) return false;
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet, isKeyless]);

  const showRemoveWalletButton = useMemo(() => {
    // Keyless wallet can also be removed
    if (isKeyless) return true;
    return (
      !wallet?.isMocked &&
      !accountUtils.isOthersWallet({ walletId: wallet?.id || '' })
    );
  }, [wallet, isKeyless]);

  const showRemoveDeviceButton = useMemo(() => {
    if (isKeyless) return false;
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet, isKeyless]);

  const showBackupButton = useMemo(() => {
    if (isKeyless) return false;
    return accountUtils.isHdWallet({ walletId: wallet?.id });
  }, [wallet, isKeyless]);

  const showBulkCopyAddressesButton = useMemo(() => {
    // if (isKeyless) return false;
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

  const navigation = useAppNavigation();

  const handleKeylessWalletAction = useCallback(
    async ({
      setLoading,
      mode,
    }: {
      setLoading: (loading: boolean) => void;
      mode: EOnboardingV2OneKeyIDLoginMode;
    }) => {
      try {
        // setLoading(true);
        await timerUtils.wait(100);
        await backgroundApiProxy.servicePassword.promptPasswordVerify({
          reason: EReasonForNeedPassword.Security,
        });
        if (platformEnv.isNative) {
          navigation.popStack();
          await timerUtils.wait(200);
        }
        await goToOneKeyIDLoginPageForKeylessWallet({ mode });
      } finally {
        // setLoading(false);
      }
    },
    [navigation, goToOneKeyIDLoginPageForKeylessWallet],
  );

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

          {/* Keyless wallet: Reset PIN */}
          {isKeyless ? (
            <ActionList.Item
              icon="InputOutline"
              label={intl.formatMessage({ id: ETranslations.reset_pin })}
              onClose={handleActionListClose}
              isLoading={isResetPinLoading}
              onPress={() => {
                void handleKeylessWalletAction({
                  setLoading: setIsResetPinLoading,
                  mode: EOnboardingV2OneKeyIDLoginMode.KeylessResetPin,
                });
              }}
            />
          ) : null}

          {/* Keyless wallet: Verify PIN */}
          {isKeyless ? (
            <ActionList.Item
              icon="ChecklistOutline"
              label="Verify PIN"
              onClose={handleActionListClose}
              isLoading={isVerifyPinLoading}
              onPress={() => {
                void handleKeylessWalletAction({
                  setLoading: setIsVerifyPinLoading,
                  mode: EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly,
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
      intl,
      isResetPinLoading,
      isVerifyPinLoading,
      showBackupButton,
      showDeviceManagementButton,
      showBulkCopyAddressesButton,
      network?.id,
      isPrimeUser,
      showAddHiddenWalletButton,
      showRemoveWalletButton,
      showRemoveDeviceButton,
      handleKeylessWalletAction,
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
