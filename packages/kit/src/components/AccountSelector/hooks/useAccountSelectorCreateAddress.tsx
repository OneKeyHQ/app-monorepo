import { useCallback } from 'react';

import { Dialog, SizableText, Stack } from '@onekeyhq/components';
import type {
  IDBDevice,
  IDBWallet,
  IDBWalletId,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAddHDOrHWAccountsResult } from '@onekeyhq/kit-bg/src/services/ServiceAccount/ServiceAccount';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyErrorAirGapWalletMismatch } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAccountSelectorActions } from '../../../states/jotai/contexts/accountSelector';
import useScanQrCode from '../../../views/ScanQrCode/hooks/useScanQrCode';

export function useCreateQrWallet() {
  const {
    start: startScan,
    // close,
  } = useScanQrCode();
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();

  const createQrWallet = useCallback(
    async ({
      isOnboarding,
      byWallet,
      byDevice,
    }: {
      isOnboarding?: boolean;
      byWallet?: IDBWallet;
      byDevice?: IDBDevice;
    }) => {
      const scanResult = await startScan({
        handlers: {},
        mask: true,
        autoHandleResult: false,
      });
      console.log('startScan:', scanResult.raw?.trim());
      const { qrDevice, airGapAccounts } =
        await backgroundApiProxy.serviceAccount.buildAirGapMultiAccounts({
          scanResult,
        });
      if (byDevice?.deviceId && qrDevice?.deviceId !== byDevice?.deviceId) {
        throw new OneKeyErrorAirGapWalletMismatch();
      }
      if (byWallet?.xfp && qrDevice?.xfp !== byWallet?.xfp) {
        throw new OneKeyErrorAirGapWalletMismatch();
      }
      if (isOnboarding) {
        navigation.push(EOnboardingPages.FinalizeWalletSetup);
      }
      const result = await actions.current.createQrWallet({
        qrDevice,
        airGapAccounts,
        isOnboarding,
      });
      return result;
    },
    [actions, navigation, startScan],
  );
  return {
    createQrWallet,
  };
}

export function useAccountSelectorCreateAddress() {
  const { serviceAccount } = backgroundApiProxy;

  const actions = useAccountSelectorActions();
  const { createQrWallet } = useCreateQrWallet();

  const createAddress = useCallback(
    async ({
      num,
      selectAfterCreate,
      account,
    }: {
      num: number;
      selectAfterCreate?: boolean;
      account: {
        walletId: IDBWalletId | undefined;
        networkId: string | undefined;
        indexedAccountId: string | undefined;
        deriveType: IAccountDeriveTypes;
      };
    }) => {
      if (
        !account ||
        !account.walletId ||
        !account.networkId ||
        !account.indexedAccountId ||
        !account.deriveType
      ) {
        return;
      }

      const handleAddAccounts = async (
        result: IAddHDOrHWAccountsResult | undefined,
      ) => {
        console.log(result);
        // await refreshCurrentAccount();
        actions.current.refresh({ num });

        if (selectAfterCreate) {
          await actions.current.updateSelectedAccountForHdOrHwAccount({
            num,
            walletId: result?.walletId,
            indexedAccountId: result?.indexedAccountId,
          });
        }
      };

      const addAccounts = async () => {
        const result = await serviceAccount.addHDOrHWAccounts({
          walletId: account?.walletId,
          networkId: account?.networkId,
          indexedAccountId: account?.indexedAccountId,
          deriveType: account?.deriveType,
        });
        await handleAddAccounts(result);
      };
      const isAirGapAccountNotFound = (error: Error | unknown) =>
        (error as IOneKeyError)?.className ===
        EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound;

      try {
        await addAccounts();
      } catch (error1) {
        if (isAirGapAccountNotFound(error1)) {
          let byDevice: IDBDevice | undefined;
          const byWallet = await serviceAccount.getWallet({
            walletId: account.walletId,
          });
          if (byWallet.associatedDevice) {
            byDevice = await serviceAccount.getDevice({
              dbDeviceId: byWallet.associatedDevice,
            });
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { wallet: walletCreated } = await createQrWallet({
            isOnboarding: false,
            byDevice,
            byWallet,
          });

          try {
            await addAccounts();
          } catch (error2) {
            if (isAirGapAccountNotFound(error2)) {
              Dialog.show({
                title: 'Address creation failed',
                showConfirmButton: false,
                onCancelText: 'Close',
                renderContent: (
                  <Stack>
                    <SizableText>
                      1. Check our website to verify if your hardware wallet
                      supports the current network.
                    </SizableText>
                    <SizableText>
                      2. Connect via USB and visit our firmware update tool.
                      Disable Air-gap mode if necessary.
                    </SizableText>
                    <SizableText>
                      3. If issues persist, the QR Wallet may not support this
                      derivation path.
                    </SizableText>
                    <SizableText>Need more help? Contact us.</SizableText>
                  </Stack>
                ),
              });
            } else {
              throw error2;
            }
          }
        } else {
          throw error1;
        }
      }
    },
    [actions, createQrWallet, serviceAccount],
  );

  return {
    createAddress,
  };
}
