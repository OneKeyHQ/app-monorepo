import { memo, useMemo } from 'react';

import { Divider, Stack } from '@onekeyhq/components';
import { useAccountSelectorEditModeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { HiddenWalletAddButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/HiddenWalletAddButton';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { Advance } from './Advance';
import { BatchCreateAccountButton } from './BatchCreateAccountButton';
import { CheckFirmwareUpdateButton } from './CheckFirmwareUpdateButton';
import { HardwareHomeScreenButton } from './HardwareHomeScreenButton';
import { HdWalletBackupButton } from './HdWalletBackupButton';
import { HiddenWalletRememberSwitch } from './HiddenWalletRememberSwitch';
import { Verification } from './Verification';
import { WalletProfile } from './WalletProfile';

import type { IWalletDetailsProps } from '..';

type IWalletOptionsProps = Partial<IWalletDetailsProps>;

function WalletOptionsView({ wallet, device }: IWalletOptionsProps) {
  const [editMode] = useAccountSelectorEditModeAtom();

  const walletSpecifiedOptions = useMemo(() => {
    // HD Wallet
    if (accountUtils.isHdWallet({ walletId: wallet?.id })) {
      return (
        <>
          <HdWalletBackupButton wallet={wallet} />
          <BatchCreateAccountButton wallet={wallet} />
        </>
      );
    }

    // HW Wallet
    if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
      // HW Hidden Wallet
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return (
          <>
            <BatchCreateAccountButton wallet={wallet} />
            <HiddenWalletRememberSwitch wallet={wallet} key={wallet?.id} />
          </>
        );
      }

      // HW Normal Wallet
      return (
        <>
          <CheckFirmwareUpdateButton device={device} />
          <Verification device={device} />
          <HardwareHomeScreenButton device={device} />
          <Advance wallet={wallet} />
          <BatchCreateAccountButton wallet={wallet} />
          <HiddenWalletAddButton wallet={wallet} />
        </>
      );
    }

    // QR Wallet
    if (accountUtils.isQrWallet({ walletId: wallet?.id })) {
      // QR Hidden Wallet
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return (
          <>
            <HiddenWalletRememberSwitch wallet={wallet} key={wallet?.id} />
          </>
        );
      }
      // QR Normal Wallet
      return (
        <>
          <HiddenWalletAddButton wallet={wallet} />
        </>
      );
    }

    return null;
  }, [device, wallet]);

  return (
    // <HeightTransition></HeightTransition>
    <Stack>
      {/* <AnimatePresence>
      </AnimatePresence> */}
      {editMode ? (
        <Stack
          testID="wallet-edit-options"
          // TODO: remove animation for better performance which cause SectionList re-render
          // animation="quick"
          // exitStyle={{
          //   opacity: 0,
          // }}
          // enterStyle={{
          //   opacity: 0,
          // }}
        >
          {(() => {
            defaultLogger.accountSelector.perf.renderWalletOptions({
              wallet,
            });
            return null;
          })()}

          {/* Profile: Avatar, Rename */}
          {wallet ? <WalletProfile wallet={wallet} /> : null}

          {/* Options: Backup, Verification, HomeScreen, Advance  */}
          {walletSpecifiedOptions}

          <Stack py="$2.5">
            <Divider mt="auto" />
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}

export const WalletOptions = memo(WalletOptionsView);
