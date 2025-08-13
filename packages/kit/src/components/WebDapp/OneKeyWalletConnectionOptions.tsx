import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, SizableText } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { EXT_RATE_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import useAppNavigation from '../../hooks/useAppNavigation';

function OneKeyWalletConnectionOptions() {
  const intl = useIntl();
  const appNavigation = useAppNavigation();

  const isOneKeyExtWalletInstalled = !!globalThis.$onekey?.$private?.isOneKey;

  const handleExtensionPress = useCallback(() => {
    console.log('OneKey wallet extension');
  }, []);

  const handleConnectHardwarePress = useCallback(() => {
    appNavigation.pushModal(EModalRoutes.OnboardingModal, {
      screen: EOnboardingPages.ConnectYourDevice,
    });
  }, [appNavigation]);

  return (
    <>
      <ListItem
        py="$4"
        px="$5"
        mx="$0"
        bg="$bgSubdued"
        title="OneKey wallet extension"
        subtitle={isOneKeyExtWalletInstalled ? 'EVM' : 'Go to Chrome Web Store'}
        renderAvatar={<Icon name="OnekeyBrand" size="$10" />}
        drillIn={isOneKeyExtWalletInstalled}
        onPress={isOneKeyExtWalletInstalled ? handleExtensionPress : undefined}
      >
        {isOneKeyExtWalletInstalled ? null : (
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
        title="OneKey hardware wallet"
        subtitle={
          <>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.wallet_hardware_wallet_connect_description_1,
              })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
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
