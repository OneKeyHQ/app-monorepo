import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  AnimatePresence,
  Divider,
  HeightTransition,
  Stack,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorEditModeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { HiddenWalletAddButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/HiddenWalletAddButton';
import { WalletRemoveButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/WalletRemove';
import useLiteCard from '@onekeyhq/kit/src/views/LiteCard/hooks/useLiteCard';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { AboutDevice } from './AboutDevice';
import { Advance } from './Advance';
import { HiddenWalletRememberSwitch } from './HiddenWalletRememberSwitch';
import { HomeScreen } from './HomeScreen';
import { Verification } from './Verification';
import { WalletOptionItem } from './WalletOptionItem';
import { WalletProfile } from './WalletProfile';

import type { IWalletDetailsProps } from '..';

type IWalletOptionsProps = Partial<IWalletDetailsProps>;

export function WalletOptions({ wallet }: IWalletOptionsProps) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const liteCard = useLiteCard();

  const handleBackupPhrase = useCallback(() => {
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
    });
  }, [navigation]);
  const handleBackupLiteCard = useCallback(() => {
    void liteCard.backupWallet(wallet?.id);
  }, [liteCard, wallet?.id]);

  const [editMode] = useAccountSelectorEditModeAtom();

  const walletSpecifiedOptions = useMemo(() => {
    if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return <HiddenWalletRememberSwitch wallet={wallet} />;
      }

      return (
        <>
          <Verification />
          <HomeScreen />
          <Advance />
          <AboutDevice />
          <HiddenWalletAddButton wallet={wallet} />
        </>
      );
    }
    return (
      <ActionList
        offset={{ mainAxis: 0, crossAxis: 18 }}
        placement="bottom-start"
        title="Backup"
        items={[
          {
            label: intl.formatMessage({
              id: 'backup__manual_backup',
            }),
            icon: 'SignatureOutline',
            onPress: handleBackupPhrase,
          },
          ...(platformEnv.isNative
            ? [
                {
                  label: intl.formatMessage({
                    id: 'app__hardware_name_onekey_lite',
                  }),
                  icon: 'OnekeyLiteOutline' as IKeyOfIcons,
                  onPress: handleBackupLiteCard,
                },
              ]
            : []),

          {
            label: 'OneKey KeyTag',
            icon: 'OnekeyKeytagOutline',
            onPress: () => console.log('clicked'),
          },
        ]}
        renderTrigger={
          <WalletOptionItem icon="Shield2CheckOutline" label="Backup" />
        }
      />
    );
  }, [handleBackupLiteCard, handleBackupPhrase, intl, wallet]);

  return (
    <HeightTransition>
      <AnimatePresence>
        {editMode && (
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
            {/* Profile */}
            {wallet ? <WalletProfile wallet={wallet} /> : null}

            {/* Options */}
            {walletSpecifiedOptions}
            <WalletRemoveButton wallet={wallet} />

            <Stack py="$2.5">
              <Divider mt="auto" />
            </Stack>
          </Stack>
        )}
      </AnimatePresence>
    </HeightTransition>
  );
}
