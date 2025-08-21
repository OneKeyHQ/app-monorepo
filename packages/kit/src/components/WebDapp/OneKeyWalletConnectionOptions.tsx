import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Image,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { EXT_RATE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useConnectExternalWallet } from '../../hooks/useWebDapp/useConnectExternalWallet';
import { useOneKeyWalletDetection } from '../../hooks/useWebDapp/useOneKeyWalletDetection';

import { WalletConnectListItemComponent } from './ExternalWalletList';

function OneKeyHardwareWalletLogo() {
  return (
    <Stack position="relative" width="$10" height="$10">
      <Image
        w="$10"
        h="$10"
        bg="$bgStrong"
        borderColor="$neutral3"
        borderWidth="1px"
        borderRadius="$2"
        source={require('@onekeyhq/kit/assets/hardwallet_together_logo.png')}
      />
      <Icon
        position="absolute"
        right="-2px"
        bottom="-2px"
        name="OnekeyBrand"
        size="$4.5"
        bg="#44D62C"
        borderRadius="$1"
      />
    </Stack>
  );
}

function OneKeyWalletConnectionOptions({
  showInModal,
}: {
  showInModal: boolean;
}) {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  const { connectToWalletWithDialog, loading } = useConnectExternalWallet();
  const { isOneKeyInstalled, getOneKeyConnectionInfo } =
    useOneKeyWalletDetection();
  const media = useMedia();

  // Track if user clicked Add button
  const [hasClickedAdd, setHasClickedAdd] = useState(false);

  // Check if mobile (small screen)
  const isMobile = media.md;

  // Get subtitle text
  const getSubtitleText = () => {
    if (isOneKeyInstalled) {
      return 'EVM';
    }
    if (hasClickedAdd) {
      return intl.formatMessage({
        id: ETranslations.wallet_onekey_wallet_without_refresh,
      });
    }
    return intl.formatMessage({
      id: ETranslations.wallet_onekey_wallet_without_description,
    });
  };

  const handleExtensionPress = useCallback(async () => {
    const connectionInfo = getOneKeyConnectionInfo();
    if (!connectionInfo) {
      console.warn('OneKey wallet not detected');
      return;
    }

    void connectToWalletWithDialog(connectionInfo);
  }, [connectToWalletWithDialog, getOneKeyConnectionInfo]);

  const handleConnectHardwarePress = useCallback(() => {
    appNavigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
    defaultLogger.account.wallet.onboard({ onboardMethod: 'connectHWWallet' });
  }, [appNavigation]);

  const handleConnectWatchOnlyPress = useCallback(() => {
    appNavigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ImportAddress,
    });
  }, [appNavigation]);

  // Mobile: show only hardware wallet + WalletConnect
  if (isMobile) {
    return (
      <>
        <ListItem
          py="$4"
          px="$5"
          mx="$0"
          bg="$bgSubdued"
          title={intl.formatMessage({
            id: ETranslations.global_onekey_wallet_hardware_wallet,
          })}
          renderAvatar={<OneKeyHardwareWalletLogo />}
          drillIn
          onPress={handleConnectHardwarePress}
        />
        <WalletConnectListItemComponent
          impl="evm"
          py="$4"
          px="$5"
          mx="$0"
          bg="$bgSubdued"
        />
        {showInModal ? (
          <ListItem
            py="$4"
            px="$5"
            mx="$0"
            bg="$bgSubdued"
            title={intl.formatMessage({
              id: ETranslations.global_watch_only_wallet,
            })}
            renderAvatar={
              <Stack
                h="$10"
                w="$10"
                bg="$bgStrong"
                borderRadius="$2"
                ai="center"
                jc="center"
              >
                <Icon name="EyeOutline" size="$6" color="$icon" />
              </Stack>
            }
            drillIn
            onPress={handleConnectWatchOnlyPress}
          />
        ) : null}
      </>
    );
  }

  // Desktop: show original layout (extension + hardware)
  return (
    <>
      <ListItem
        py="$4"
        px="$5"
        mx="$0"
        bg="$bgSubdued"
        hoverStyle={{
          bg: '$bgStrong',
        }}
        cursor={isOneKeyInstalled ? 'pointer' : undefined}
        title={intl.formatMessage({
          id: ETranslations.global_onekey_wallet_extension,
        })}
        subtitle={getSubtitleText()}
        renderAvatar={
          <Stack position="relative" width="$10" height="$10">
            <Icon
              name="OnekeyBrand"
              size="$10"
              bg="#44D62C"
              borderRadius="$2"
            />
            <Image
              w="$4.5"
              h="$4.5"
              position="absolute"
              right="-2px"
              bottom="-2px"
              source={require('@onekeyhq/kit/assets/chrome.png')}
            />
          </Stack>
        }
        drillIn={Boolean(isOneKeyInstalled && !loading)}
        onPress={isOneKeyInstalled ? handleExtensionPress : undefined}
        isLoading={loading}
      >
        {isOneKeyInstalled ? null : (
          <Button
            size="small"
            variant="secondary"
            cursor="pointer"
            onPress={() => {
              setHasClickedAdd(true);
              openUrlExternal(EXT_RATE_URL.chrome);
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_add })}
          </Button>
        )}
      </ListItem>
      <ListItem
        py="$4"
        px="$5"
        mx="$0"
        bg="$bgSubdued"
        cursor="pointer"
        title={intl.formatMessage({
          id: ETranslations.global_onekey_wallet_hardware_wallet,
        })}
        subtitle={
          <>
            <SizableText size="$bodyMd" color="$textSubdued">
              1.{' '}
              {intl.formatMessage({
                id: ETranslations.wallet_hardware_wallet_connect_description_1,
              })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              2.{' '}
              {intl.formatMessage({
                id: ETranslations.wallet_hardware_wallet_connect_description_2,
              })}
            </SizableText>
          </>
        }
        renderAvatar={<OneKeyHardwareWalletLogo />}
        drillIn
        onPress={handleConnectHardwarePress}
      />
    </>
  );
}

export { OneKeyWalletConnectionOptions };
