import { useMemo } from 'react';

import {
  AnimatePresence,
  Divider,
  HeightTransition,
  Stack,
} from '@onekeyhq/components';
import { useAccountSelectorEditModeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { HiddenWalletAddButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/HiddenWalletAddButton';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { Advance } from './Advance';
import { BatchCreateAccountButton } from './BatchCreateAccountButton';
import { HdWalletBackupButton } from './HdWalletBackupButton';
import { HiddenWalletRememberSwitch } from './HiddenWalletRememberSwitch';
import { Verification } from './Verification';
import { WalletProfile } from './WalletProfile';

import type { IWalletDetailsProps } from '..';

type IWalletOptionsProps = Partial<IWalletDetailsProps>;

export function WalletOptions({ wallet, device }: IWalletOptionsProps) {
  const [editMode] = useAccountSelectorEditModeAtom();

  const walletSpecifiedOptions = useMemo(() => {
    if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return (
          <>
            <BatchCreateAccountButton wallet={wallet} />
            <HiddenWalletRememberSwitch wallet={wallet} key={wallet?.id} />
          </>
        );
      }

      return (
        <>
          <Verification device={device} />
          {/* Homescreen unsupprted yet */}
          {/* <HomeScreen /> */}
          <Advance wallet={wallet} />
          <BatchCreateAccountButton wallet={wallet} />
          <HiddenWalletAddButton wallet={wallet} />
        </>
      );
    }

    if (accountUtils.isHdWallet({ walletId: wallet?.id })) {
      return (
        <>
          <BatchCreateAccountButton wallet={wallet} />
          <HdWalletBackupButton wallet={wallet} />
        </>
      );
    }

    return null;
  }, [device, wallet]);

  return (
    <HeightTransition>
      <AnimatePresence>
        {editMode ? (
          <Stack
            testID="wallet-edit-options"
            animation="quick"
            exitStyle={{
              opacity: 0,
            }}
            enterStyle={{
              opacity: 0,
            }}
          >
            {/* Profile: Avatar, Rename */}
            {wallet ? <WalletProfile wallet={wallet} /> : null}

            {/* Options: Backup, Verification, HomeScreen, Advance  */}
            {walletSpecifiedOptions}

            <Stack py="$2.5">
              <Divider mt="auto" />
            </Stack>
          </Stack>
        ) : null}
      </AnimatePresence>
    </HeightTransition>
  );
}
