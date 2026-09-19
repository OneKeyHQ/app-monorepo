import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Button, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import { resolveUsableWalletWithDevice } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails/deviceStateManagement';
import { useNavigateToPickYourDevicePage } from '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage';
import type {
  IDBDevice,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getTitleAndDescription,
  showWalletRemoveDialog,
} from '../../../components/WalletEdit/WalletRemoveDialog';
import { AccountManagerTestIDs } from '../../../testIDs';

export function DeprecatedWalletBanner({
  num,
  wallet,
  device,
  editable,
}: {
  num: number;
  wallet: IDBWallet;
  device: IDBDevice | undefined;
  // Removing the wallet and adding a device are management actions, offered
  // only where the selector allows editing. Switching wallets always is.
  editable: boolean;
}) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();
  const { config } = useAccountSelectorContextData();
  const toPickYourDevicePage = useNavigateToPickYourDevicePage();

  // The wallet info is re-cloned on every list reload; one lookup per wallet
  // and device record is enough, so key it on their ids.
  const walletWithDevice = useMemo(
    () => ({ wallet, device }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet.id, device?.id],
  );

  // A reset gives the device a new identity, so re-adding it creates a new
  // wallet next to this stale one. Resolves to null when it was not re-added.
  const { result: replacementWallet } = usePromiseResult(async () => {
    const wallets =
      await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
        filterHiddenWallet: true,
        filterQrWallet: true,
      });
    // Falls back to the wallet passed in when the device has no usable wallet.
    const usable = resolveUsableWalletWithDevice(
      walletWithDevice,
      Object.values(wallets),
    );
    return usable && usable.wallet.id !== walletWithDevice.wallet.id
      ? usable.wallet
      : null;
  }, [walletWithDevice]);

  const handlePrimaryPress = useCallback(() => {
    if (replacementWallet) {
      void actions.current.updateSelectedAccountFocusedWallet({
        num,
        focusedWallet: replacementWallet.id,
      });
      return;
    }
    void toPickYourDevicePage();
  }, [actions, num, replacementWallet, toPickYourDevicePage]);

  const handleRemovePress = useCallback(() => {
    const { title, description, isHwOrQr } = getTitleAndDescription({
      wallet,
      intl,
    });
    showWalletRemoveDialog({
      nativeSheet: true,
      config,
      title,
      description,
      showCheckBox: !isHwOrQr,
      defaultChecked: false,
      wallet,
    });
  }, [config, intl, wallet]);

  // Wait for the lookup so the banner never flashes the wrong situation.
  if (replacementWallet === undefined) {
    return null;
  }

  const t = (id: ETranslations) =>
    intl.formatMessage({ id }, { name: replacementWallet?.name });
  const copy = replacementWallet
    ? {
        title: t(ETranslations.wallet_device_reset_replaced__title),
        description: t(ETranslations.wallet_device_reset_replaced__desc),
        primary: t(ETranslations.wallet_device_reset_switch__action),
      }
    : {
        title: t(ETranslations.wallet_device_reset__title),
        description: t(ETranslations.wallet_device_reset__desc),
        primary: t(ETranslations.wallet_device_reset_add_device__action),
      };
  // Without edit rights the only action left is switching to the new wallet.
  const showActions = Boolean(replacementWallet) || editable;

  return (
    <Alert
      fullBleed
      type="warning"
      mb="$2"
      title={copy.title}
      description={copy.description}
    >
      {showActions ? (
        // Tertiary buttons carry a -9 horizontal margin, so the column gap has
        // to cover it to leave visible space next to the primary button.
        <XStack pt="$2" columnGap="$5" rowGap="$3" flexWrap="wrap">
          <Button
            testID={AccountManagerTestIDs.deprecatedWalletPrimaryButton}
            size="small"
            variant="primary"
            maxWidth="100%"
            textEllipsis
            onPress={handlePrimaryPress}
          >
            {copy.primary}
          </Button>
          {editable ? (
            <Button
              testID={AccountManagerTestIDs.deprecatedWalletRemoveButton}
              size="small"
              variant="tertiary"
              onPress={handleRemovePress}
            >
              {t(ETranslations.global_remove)}
            </Button>
          ) : null}
        </XStack>
      ) : null}
    </Alert>
  );
}
