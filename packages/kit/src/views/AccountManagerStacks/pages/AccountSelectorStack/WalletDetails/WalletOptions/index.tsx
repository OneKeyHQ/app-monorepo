import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  ActionList,
  AnimatePresence,
  Divider,
  HeightTransition,
  Stack,
  Toast,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAccountSelectorEditModeAtom } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { HiddenWalletAddButton } from '@onekeyhq/kit/src/views/AccountManagerStacks/components/HiddenWalletAddButton';
import useLiteCard from '@onekeyhq/kit/src/views/LiteCard/hooks/useLiteCard';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

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
    Toast.error({
      title: '功能未实现',
    });
    navigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.BeforeShowRecoveryPhrase,
    });
  }, [navigation]);
  const handleBackupLiteCard = useCallback(() => {
    void liteCard.backupWallet(wallet?.id);
  }, [liteCard, wallet?.id]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleBackupPress = useCallback(() => {
    ActionList.show({
      title: 'Backup',
      sections: [
        {
          items: [
            {
              label: `${intl.formatMessage({
                id: 'backup__manual_backup',
              })}`,
              icon: 'PenOutline',
              onPress: handleBackupPhrase,
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
          ],
        },
      ],
    });
  }, [intl, handleBackupPhrase, handleBackupLiteCard]);

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

            <Stack py="$2.5">
              <Divider mt="auto" />
            </Stack>
          </Stack>
        )}
      </AnimatePresence>
    </HeightTransition>
  );
}
