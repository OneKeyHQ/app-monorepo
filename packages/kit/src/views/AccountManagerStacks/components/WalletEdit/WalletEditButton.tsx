import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  ActionList,
  Dialog,
  Divider,
  Toast,
  resetAccountManagerStacksModal,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import {
  useKeylessWallet,
  useVerifyKeylessPinChecking,
} from '@onekeyhq/kit/src/components/KeylessWallet/useKeylessWallet';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { shouldShowMnemonicBackupEntryForWallet } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getVendorProfile } from '@onekeyhq/shared/src/hardware/vendorProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
  EOnboardingV2OneKeyIDLoginMode,
} from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { AccountManagerTestIDs } from '../../testIDs';

import { AddHiddenWalletButton } from './AddHiddenWalletButton';
import { DeviceManagementButton } from './DeviceManagementButton';
import { HdWalletBackupButton } from './HdWalletBackupButton';
import { WalletBoundReferralCodeButton } from './WalletBoundReferralCodeButton';
import {
  shouldShowAddHiddenWalletButtonForWallet,
  shouldShowDeviceManagementButtonForWallet,
} from './WalletEditButtonUtils';
import { WalletRemoveButton } from './WalletRemoveButton';

function WalletEditButtonView({ wallet }: { wallet?: IDBWallet }) {
  const intl = useIntl();
  const { config } = useAccountSelectorContextData();
  const isKeyless = useMemo(() => wallet?.isKeyless, [wallet]);
  const [devSettings] = useDevSettingsPersistAtom();

  const { goToOneKeyIDLoginPageForKeylessWallet } = useKeylessWallet();
  const { verifyKeylessPinChecking } = useVerifyKeylessPinChecking();

  const [isResetPinLoading, setIsResetPinLoading] = useState(false);
  const [isVerifyPinLoading, _setIsVerifyPinLoading] = useState(false);

  // True when the wallet is bound to a third-party hardware vendor.
  // Used only for entries that are still third-party-wide exclusions. Device
  // management and hidden-wallet creation are gated by vendor capability below.
  const isThirdPartyVendorWallet = useMemo(() => {
    return Boolean(
      wallet?.associatedDeviceInfo?.vendor &&
      getVendorProfile(wallet.associatedDeviceInfo.vendor).isThirdParty,
    );
  }, [wallet]);

  const showDeviceManagementButton = useMemo(() => {
    return shouldShowDeviceManagementButtonForWallet({
      isKeyless,
      isHiddenWallet: accountUtils.isHwHiddenWallet({ wallet }),
      isHwOrQrWallet: accountUtils.isHwOrQrWallet({ walletId: wallet?.id }),
      vendor: wallet?.associatedDeviceInfo?.vendor,
    });
  }, [wallet, isKeyless]);

  const showAddHiddenWalletButton = useMemo(() => {
    return shouldShowAddHiddenWalletButtonForWallet({
      isKeyless,
      isHiddenWallet: accountUtils.isHwHiddenWallet({ wallet }),
      isHwOrQrWallet: accountUtils.isHwOrQrWallet({ walletId: wallet?.id }),
      vendor: wallet?.associatedDeviceInfo?.vendor,
    });
  }, [wallet, isKeyless]);

  const showRemoveWalletButton = useMemo(() => {
    // Keyless wallet can also be removed
    if (isKeyless) return true;
    // Third-party standard wallets remove via "remove device"; keep the delete
    // entry for their hidden wallets.
    if (
      isThirdPartyVendorWallet &&
      !accountUtils.isHwHiddenWallet({ wallet })
    ) {
      return false;
    }
    if (
      platformEnv.isWebDappMode &&
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    ) {
      return false;
    }
    return (
      !wallet?.isMocked &&
      !accountUtils.isOthersWallet({ walletId: wallet?.id || '' })
    );
  }, [wallet, isKeyless, isThirdPartyVendorWallet]);

  const showRemoveDeviceButton = useMemo(() => {
    if (isKeyless) return false;
    return (
      !accountUtils.isHwHiddenWallet({ wallet }) &&
      accountUtils.isHwOrQrWallet({ walletId: wallet?.id })
    );
  }, [wallet, isKeyless]);

  const showBackupButton = useMemo(() => {
    return shouldShowMnemonicBackupEntryForWallet({
      walletId: wallet?.id,
      isKeylessWallet: isKeyless,
    });
  }, [wallet, isKeyless]);

  const isBotWalletFeatureEnabled = useMemo(
    () =>
      Boolean(
        devSettings.enabled && devSettings.settings?.enableBotWalletFeature,
      ),
    [devSettings.enabled, devSettings.settings?.enableBotWalletFeature],
  );

  const showBotWalletManagerButton = useMemo(
    () => Boolean(isKeyless && wallet?.id && isBotWalletFeatureEnabled),
    [isKeyless, wallet?.id, isBotWalletFeatureEnabled],
  );

  const navigation = useAppNavigation();

  const handleKeylessWalletAction = useCallback(
    async ({
      setLoading: _setLoading,
      mode,
    }: {
      setLoading: (loading: boolean) => void;
      mode: EOnboardingV2OneKeyIDLoginMode;
    }) => {
      let loadingDialog: IDialogInstance | undefined;

      try {
        // _setLoading(true);
        await timerUtils.wait(100);
        await backgroundApiProxy.servicePassword.promptPasswordVerify({
          reason: EReasonForNeedPassword.Security,
        });
        loadingDialog = Dialog.loading({
          title: intl.formatMessage({
            id: ETranslations.global_preparing,
          }),
        });
        const isHealthy =
          await backgroundApiProxy.serviceKeylessWallet.apiCheckAuthServerStatus();
        if (!isHealthy) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.auth_server_error_text,
            }),
          });
          return;
        }
        if (platformEnv.isNative) {
          resetAccountManagerStacksModal();
          await timerUtils.wait(200);
        }
        await goToOneKeyIDLoginPageForKeylessWallet({ mode });
      } finally {
        // setLoading(false);
        void loadingDialog?.close();
      }
    },
    [goToOneKeyIDLoginPageForKeylessWallet, intl],
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
          {isThirdPartyVendorWallet ? null : (
            <WalletBoundReferralCodeButton
              wallet={wallet}
              onClose={handleActionListClose}
            />
          )}

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
          {isKeyless && devSettings.enabled ? (
            <ActionList.Item
              icon="ChecklistOutline"
              label="Verify PIN"
              onClose={handleActionListClose}
              isLoading={isVerifyPinLoading}
              onPress={async (close) => {
                if (wallet) {
                  close();
                  resetAccountManagerStacksModal();
                  await timerUtils.wait(200);
                  void verifyKeylessPinChecking({ forceVerify: true, wallet });
                }
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

          {showBotWalletManagerButton ? (
            <ActionList.Item
              icon="WalletOutline"
              label="Bot Wallets"
              onClose={handleActionListClose}
              onPress={() => {
                navigation.push(EAccountManagerStacksRoutes.BotWalletManager, {
                  parentKeylessWalletId: wallet?.id || '',
                });
              }}
            />
          ) : null}

          {showAddHiddenWalletButton ? (
            <AddHiddenWalletButton
              wallet={wallet}
              onClose={handleActionListClose}
            />
          ) : null}

          {isKeyless ? (
            <ActionList.Item
              icon="CloudOutline"
              label={intl.formatMessage({
                id: ETranslations.global_onekey_cloud,
              })}
              onClose={handleActionListClose}
              onPress={() => {
                navigation.pushModal(EModalRoutes.PrimeModal, {
                  screen: EPrimePages.PrimeCloudSync,
                });
              }}
            />
          ) : null}

          {isKeyless ||
          showDeviceManagementButton ||
          showAddHiddenWalletButton ? (
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
      devSettings.enabled,
      showBackupButton,
      showDeviceManagementButton,
      showBotWalletManagerButton,
      showAddHiddenWalletButton,
      showRemoveWalletButton,
      showRemoveDeviceButton,
      isThirdPartyVendorWallet,
      handleKeylessWalletAction,
      verifyKeylessPinChecking,
      navigation,
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
          testID={AccountManagerTestIDs.walletEditButton(wallet?.name || '')}
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
