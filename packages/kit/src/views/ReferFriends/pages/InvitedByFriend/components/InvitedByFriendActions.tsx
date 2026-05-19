import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useOneKeyWalletDetection } from '@onekeyhq/kit/src/hooks/useWebDapp/useOneKeyWalletDetection';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useBindReferralViaExtension } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useBindReferralViaExtension';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { EXT_RATE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { ReferFriendsTestIDs } from '../../../testIDs';

interface IInvitedByFriendActionsProps {
  referralCode: string;
  page?: string;
}

function OptionCard({
  icon,
  title,
  description,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['name'];
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Stack
      borderWidth={1}
      borderColor="$borderStrong"
      borderRadius="$3"
      p="$3"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={onPress}
      cursor="pointer"
    >
      <XStack alignItems="center" gap="$3">
        <Stack
          bg="$bgStrong"
          borderRadius="$2"
          p="$2"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name={icon} size="$5" color="$iconSubdued" />
        </Stack>
        <YStack flex={1} gap="$0.5">
          <SizableText size="$bodyLgMedium">{title}</SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            {description}
          </SizableText>
        </YStack>
        <Icon name="ChevronRightSmallOutline" size="$5" color="$iconSubdued" />
      </XStack>
    </Stack>
  );
}

function WebWalletOptions({
  referralCode,
  page,
  onBack,
}: {
  referralCode: string;
  page?: string;
  onBack: () => void;
}) {
  const intl = useIntl();

  const handleOpenDesktop = useCallback(() => {
    defaultLogger.referral.page.clickAcceptInviteButton({
      referralCode,
      acceptMethod: 'web_no_extension',
    });
    const deepLinkUrl = uriUtils.buildDeepLinkUrl({
      path: EOneKeyDeepLinkPath.invited_by_friend,
      query: { code: referralCode, page },
    });
    globalThis.location.href = deepLinkUrl;
  }, [referralCode, page]);

  const handleGetExtension = useCallback(() => {
    defaultLogger.referral.page.clickAcceptInviteButton({
      referralCode,
      acceptMethod: 'web_get_extension',
    });
    globalThis.open(EXT_RATE_URL.chrome, '_blank');
  }, [referralCode]);

  return (
    <YStack bg="$bgApp">
      <YStack gap="$2" w="100%" px="$4" pt="$4" pb="$2">
        <SizableText size="$bodyMdMedium" color="$textSubdued" mb="$1">
          {intl.formatMessage({
            id: ETranslations.referral_choose_how_to_bind,
          })}
        </SizableText>

        <OptionCard
          icon="MonitorOutline"
          title={intl.formatMessage({
            id: ETranslations.referral_desktop_app,
          })}
          description={intl.formatMessage({
            id: ETranslations.referral_open_in_desktop_application,
          })}
          onPress={handleOpenDesktop}
        />

        <OptionCard
          icon="DownloadOutline"
          title={intl.formatMessage({
            id: ETranslations.referral_get_browser_extension,
          })}
          description={intl.formatMessage({
            id: ETranslations.referral_install_from_chrome_web_store,
          })}
          onPress={handleGetExtension}
        />
      </YStack>

      <XStack px="$4" py="$4">
        <Button
          testID={ReferFriendsTestIDs.webOptionsCancelBtn}
          variant="secondary"
          w="100%"
          $md={{ size: 'large' }}
          onPress={onBack}
        >
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
      </XStack>
    </YStack>
  );
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
  const [showWebOptions, setShowWebOptions] = useState(false);
  const { isOneKeyInstalled } = useOneKeyWalletDetection();
  const { bindViaExtension, isBinding } = useBindReferralViaExtension({
    referralCode,
    onSuccess: () => navigation.pop(),
  });

  const handleCancel = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const handleJoin = useCallback(() => {
    if (platformEnv.isWeb) {
      if (isOneKeyInstalled) {
        defaultLogger.referral.page.clickAcceptInviteButton({
          referralCode,
          acceptMethod: 'web_extension',
        });
        void bindViaExtension();
        return;
      }
      // No extension → show options (desktop app / install extension)
      setShowWebOptions(true);
      return;
    }

    defaultLogger.referral.page.clickAcceptInviteButton({
      referralCode,
      acceptMethod: 'local_app',
    });
    bindWalletInviteCode({
      wallet: activeAccount?.wallet,
      defaultReferralCode: referralCode,
      onSuccess: () => {
        navigation.pop();
      },
    });
  }, [
    activeAccount?.wallet,
    bindWalletInviteCode,
    bindViaExtension,
    isOneKeyInstalled,
    referralCode,
    navigation,
  ]);

  if (showWebOptions) {
    return (
      <WebWalletOptions
        referralCode={referralCode}
        page={page}
        onBack={() => setShowWebOptions(false)}
      />
    );
  }

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
        testID={ReferFriendsTestIDs.cancelBtn}
        variant="secondary"
        $md={{ flex: 1, flexBasis: 0, size: 'large' }}
        onPress={handleCancel}
        disabled={isBinding}
      >
        {intl.formatMessage({ id: ETranslations.global_cancel })}
      </Button>
      <Button
        testID={ReferFriendsTestIDs.acceptBtn}
        variant="primary"
        $md={{ flex: 1, flexBasis: 0, size: 'large' }}
        onPress={handleJoin}
        loading={isBinding}
        disabled={isBinding}
      >
        {intl.formatMessage({ id: ETranslations.wallet_subsidy_claim })}
      </Button>
    </XStack>
  );
}

export { InvitedByFriendActions };
