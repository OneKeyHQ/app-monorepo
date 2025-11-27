import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

interface IInvitedByFriendActionsProps {
  referralCode: string;
  page?: string;
}

function InvitedByFriendActions({
  referralCode,
  page,
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
    } else if (platformEnv.isWeb) {
      const url = uriUtils.buildDeepLinkUrl({
        path: EOneKeyDeepLinkPath.invited_by_friend,
        query: {
          code: referralCode,
          page,
        },
      });
      globalThis.location.href = url;
    } else {
      bindWalletInviteCode({
        defaultReferralCode: referralCode,
        onSuccess: () => {
          navigation.pop();
        },
      });
    }
  }, [
    activeAccount?.wallet,
    bindWalletInviteCode,
    referralCode,
    page,
    navigation,
  ]);

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
