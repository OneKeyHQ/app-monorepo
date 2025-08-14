import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, useMedia } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { EXT_RATE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import useAppNavigation from '../../hooks/useAppNavigation';
import { useConnectExternalWallet } from '../../hooks/useWebDapp/useConnectExternalWallet';
import { useOneKeyWalletDetection } from '../../hooks/useWebDapp/useOneKeyWalletDetection';

import { WalletConnectListItemComponent } from './ExternalWalletList';

function OneKeyWalletConnectionOptions() {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  const { connectToWalletWithDialog, loading } = useConnectExternalWallet();
  const { isOneKeyInstalled, getOneKeyConnectionInfo } =
    useOneKeyWalletDetection();
  const media = useMedia();

  // Check if mobile (small screen)
  const isMobile = media.md;

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
          renderAvatar={<Icon name="OnekeyBrand" size="$10" />}
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
        title={intl.formatMessage({
          id: ETranslations.global_onekey_wallet_extension,
        })}
        subtitle={isOneKeyInstalled ? 'EVM' : 'Go to Chrome Web Store'}
        renderAvatar={<Icon name="OnekeyBrand" size="$10" />}
        drillIn={Boolean(isOneKeyInstalled && !loading)}
        onPress={isOneKeyInstalled ? handleExtensionPress : undefined}
        isLoading={loading}
      >
        {isOneKeyInstalled ? null : (
          <Button
            size="small"
            variant="secondary"
            onPress={() => {
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
        renderAvatar={<Icon name="OnekeyBrand" size="$10" />}
        drillIn
        onPress={handleConnectHardwarePress}
      />
    </>
  );
}

export { OneKeyWalletConnectionOptions };
