import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Icon,
  Image,
  Pressable,
  Spinner,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import LogoOKX from '@onekeyhq/kit/assets/onboarding/logo_okx_wallet.png';
import LogoRainbow from '@onekeyhq/kit/assets/onboarding/logo_rainbow.png';
import LogoTrustWallet from '@onekeyhq/kit/assets/onboarding/logo_trustwallet.png';
import LogoWalletconnect from '@onekeyhq/kit/assets/onboarding/logo_walletconnect.png';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useAppStateChange } from '../../../../hooks/useAppStateChange';
import { useOnboardingDone } from '../../../../hooks/useOnboardingRequired';
import { wait } from '../../../../utils/helper';
import { useAddExternalAccount } from '../../../ExternalAccount/useAddExternalAccount';
import { useConnectExternalWallet } from '../../../ExternalAccount/useConnectExternalWallet';

export function ConnectThirdPartyWallet({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  const { addExternalAccount } = useAddExternalAccount();
  const onboardingDone = useOnboardingDone();
  const [loading, setLoading] = useState<boolean>(false);

  const onConnectResult = useCallback(
    async (result) => {
      setLoading(false);
      await addExternalAccount(result);
      await onboardingDone();
      await wait(600);
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__account_imported' }),
      });
    },
    [addExternalAccount, intl, onboardingDone],
  );

  const { connectExternalWallet } = useConnectExternalWallet({
    onConnectResult,
  });

  const onWalletConnectDirectly = useCallback(async () => {
    try {
      await connectExternalWallet({});
    } catch (error) {
      debugLogger.common.error(error);
    }
  }, [connectExternalWallet]);

  const onAppStateChange = useCallback(() => {
    setLoading(false);
  }, []);
  useAppStateChange(onAppStateChange);

  const logos = [
    LogoMetaMask,
    LogoOKX,
    LogoTrustWallet,
    LogoRainbow,
    LogoWalletconnect,
  ];

  return (
    <Pressable
      flexDirection="row"
      alignSelf="center"
      flexWrap="wrap"
      justifyContent="center"
      alignItems="center"
      p="8px"
      mt="24px"
      borderRadius="12px"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      onPress={() => {
        if (platformEnv.isNativeAndroid) {
          setLoading(true);
          onWalletConnectDirectly();
        } else {
          onPress();
        }
      }}
    >
      <Text
        typography={{ sm: 'Body2Strong', md: 'DisplaySmall' }}
        color="text-default"
      >
        {intl.formatMessage({ id: 'action__connect_3rd_party_wallet' })}
      </Text>
      <Box flexDirection="row" alignItems="center" mx={1.5}>
        {logos.map((logo, index) => (
          <Image
            key={index}
            source={logo}
            size={4}
            mx={0.5}
            rounded="sm"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="border-subdued"
          />
        ))}
        {!platformEnv.isExtension && (
          <Box bg="surface-neutral-default" borderRadius="6px" mx={0.5}>
            <Icon
              name="EllipsisHorizontalMini"
              size={16}
              color="icon-default"
            />
          </Box>
        )}
      </Box>
      {loading ? (
        <Spinner />
      ) : (
        <Icon name="ChevronRightMini" size={20} color="icon-subdued" />
      )}
    </Pressable>
  );
}
