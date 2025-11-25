import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface IInvitedByFriendActionsProps {
  referralCode: string;
}

function InvitedByFriendActions({
  referralCode,
}: IInvitedByFriendActionsProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { bindWalletInviteCode } = useWalletBoundReferralCode({
    entry: 'modal',
  });

  const handleCancel = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const handleJoin = useCallback(() => {
    if (activeAccount?.wallet) {
      bindWalletInviteCode({
        wallet: activeAccount.wallet,
        defaultReferralCode: referralCode,
        onSuccess: () => {
          navigation.pop();
        },
      });
    } else {
      bindWalletInviteCode({
        defaultReferralCode: referralCode,
        onSuccess: () => {
          navigation.pop();
        },
      });
    }
  }, [activeAccount?.wallet, bindWalletInviteCode, referralCode, navigation]);

  return (
    <XStack
      gap="$4"
      w="100%"
      justifyContent="flex-end"
      $md={{ justifyContent: 'space-between' }}
      px="$4"
      py="$4"
      bg="$bgApp"
    >
      <Button
        variant="secondary"
        $md={{ flex: 1, flexBasis: 0, size: 'large' }}
        onPress={handleCancel}
      >
        {intl.formatMessage({
          id: ETranslations.global_cancel,
        })}
      </Button>
      <Button
        variant="primary"
        $md={{ flex: 1, flexBasis: 0, size: 'large' }}
        onPress={handleJoin}
      >
        {intl.formatMessage({
          id: ETranslations.global_join,
        })}
      </Button>
    </XStack>
  );
}

export { InvitedByFriendActions };
