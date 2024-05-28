import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  AnimatePresence,
  Divider,
  HeightTransition,
  Stack,
} from '@onekeyhq/components';
import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorEditModeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { HiddenWalletAddButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/HiddenWalletAddButton';
import useLiteCard from '@onekeyhq/kit/src/views/LiteCard/hooks/useLiteCard';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalKeyTagRoutes,
  EModalRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { Advance } from './Advance';
import { HiddenWalletRememberSwitch } from './HiddenWalletRememberSwitch';
import { HomeScreen } from './HomeScreen';
import { Verification } from './Verification';
import { WalletOptionItem } from './WalletOptionItem';
import { WalletProfile } from './WalletProfile';

import type { IWalletDetailsProps } from '..';

type IWalletOptionsProps = Partial<IWalletDetailsProps>;

export function WalletOptions({ wallet, device }: IWalletOptionsProps) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const liteCard = useLiteCard();

  const handleBackupPhrase = useCallback(async () => {
    if (!wallet?.id) {
      return;
    }
    const { mnemonic } =
      await backgroundApiProxy.serviceAccount.getHDAccountMnemonic({
        walletId: wallet?.id,
        reason: EReasonForNeedPassword.Security,
      });
    if (mnemonic) ensureSensitiveTextEncoded(mnemonic);
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
      params: {
        mnemonic,
        isBackup: true,
      },
    });
  }, [navigation, wallet?.id]);
  const handleBackupLiteCard = useCallback(() => {
    void liteCard.backupWallet(wallet?.id);
  }, [liteCard, wallet?.id]);

  const handleBackupKeyTag = useCallback(async () => {
    if (wallet) {
      const { mnemonic: encodedText } =
        await backgroundApiProxy.serviceAccount.getHDAccountMnemonic({
          walletId: wallet.id,
          reason: EReasonForNeedPassword.Security,
        });
      if (encodedText) ensureSensitiveTextEncoded(encodedText);
      navigation.pushModal(EModalRoutes.KeyTagModal, {
        screen: EModalKeyTagRoutes.BackupDotMap,
        params: {
          encodedText,
          title: wallet.name,
        },
      });
    }
  }, [navigation, wallet]);

  const [editMode] = useAccountSelectorEditModeAtom();

  const walletSpecifiedOptions = useMemo(() => {
    if (accountUtils.isHwWallet({ walletId: wallet?.id })) {
      if (accountUtils.isHwHiddenWallet({ wallet })) {
        return <HiddenWalletRememberSwitch wallet={wallet} />;
      }

      return (
        <>
          <Verification device={device} />
          <HomeScreen />
          <Advance wallet={wallet} />
          <HiddenWalletAddButton wallet={wallet} />
        </>
      );
    }

    if (accountUtils.isHdWallet({ walletId: wallet?.id })) {
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
              icon: 'PenOutline',
              onPress: () => void handleBackupPhrase(),
            },
            ...(platformEnv.isNative
              ? [
                  {
                    label: intl.formatMessage({
                      id: 'app__hardware_name_onekey_lite',
                    }),
                    icon: 'GiroCardOutline' as IKeyOfIcons,
                    onPress: handleBackupLiteCard,
                  },
                ]
              : []),
            {
              label: 'OneKey KeyTag',
              icon: 'OnekeyKeytagOutline',
              onPress: () => void handleBackupKeyTag(),
            },
          ]}
          renderTrigger={
            <WalletOptionItem icon="Shield2CheckOutline" label="Backup" />
          }
        />
      );
    }
    return null;
  }, [
    device,
    handleBackupLiteCard,
    handleBackupPhrase,
    handleBackupKeyTag,
    intl,
    wallet,
  ]);

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
