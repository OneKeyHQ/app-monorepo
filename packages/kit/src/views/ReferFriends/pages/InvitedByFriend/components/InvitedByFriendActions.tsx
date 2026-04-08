import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useWalletBoundReferralCode } from '@onekeyhq/kit/src/views/ReferFriends/hooks/useWalletBoundReferralCode';
import { EXT_RATE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

type IEthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function getOneKeyExtensionProvider(): IEthereumProvider | null {
  // OneKey extension injects $onekey.ethereum as its dedicated provider
  const provider = (globalThis as Record<string, unknown>).$onekey as
    | { ethereum?: IEthereumProvider }
    | undefined;
  return provider?.ethereum ?? null;
}

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
    defaultLogger.referral.page.acceptReferralInvitation({
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
    defaultLogger.referral.page.acceptReferralInvitation({
      referralCode,
      acceptMethod: 'web_no_extension',
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
  const [isBinding, setIsBinding] = useState(false);

  const handleCancel = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const bindViaExtension = useCallback(async () => {
    const provider = getOneKeyExtensionProvider();
    if (!provider) return;

    setIsBinding(true);
    let success = false;
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const address = accounts?.[0];
      if (!address) {
        throw new OneKeyLocalError('No account returned from extension');
      }

      const networkId = getNetworkIdsMap().eth;

      const message =
        await backgroundApiProxy.serviceReferralCode.getBoundReferralCodeUnsignedMessage(
          { address, networkId, inviteCode: referralCode },
        );

      const signature = (await provider.request({
        method: 'personal_sign',
        params: [message, address],
      })) as string;

      await backgroundApiProxy.serviceReferralCode.boundReferralCodeWithSignedMessage(
        { networkId, address, referralCode, signature },
      );

      await backgroundApiProxy.serviceReferralCode.setCachedInviteCode('');
      success = true;
    } catch (error) {
      // EIP-1193: code 4001 = user rejected — silently ignore
      const err = error as { code?: number };
      if (err?.code !== 4001) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
    } finally {
      // Always disconnect dApp session to clean up "connected to localhost"
      try {
        await provider.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // Ignore revocation errors
      }
      setIsBinding(false);
      if (success) {
        Toast.success({
          title: intl.formatMessage({ id: ETranslations.global_success }),
        });
        navigation.pop();
      }
    }
  }, [referralCode, intl, navigation]);

  const handleJoin = useCallback(() => {
    if (platformEnv.isWeb) {
      // Extension installed → bind directly
      if (getOneKeyExtensionProvider()) {
        defaultLogger.referral.page.acceptReferralInvitation({
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

    defaultLogger.referral.page.acceptReferralInvitation({
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
        variant="secondary"
        $md={{ flex: 1, flexBasis: 0, size: 'large' }}
        onPress={handleCancel}
        disabled={isBinding}
      >
        {intl.formatMessage({ id: ETranslations.global_cancel })}
      </Button>
      <Button
        variant="primary"
        $md={{ flex: 1, flexBasis: 0, size: 'large' }}
        onPress={handleJoin}
        loading={isBinding}
        disabled={isBinding}
      >
        {intl.formatMessage({ id: ETranslations.referral_accept })}
      </Button>
    </XStack>
  );
}

export { InvitedByFriendActions };
