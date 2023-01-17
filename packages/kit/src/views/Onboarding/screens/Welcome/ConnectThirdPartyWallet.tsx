import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Image,
  Pressable,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import LogoMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import LogoRainbow from '@onekeyhq/kit/assets/onboarding/logo_rainbow.png';
import LogoTrustWallet from '@onekeyhq/kit/assets/onboarding/logo_trustwallet.png';
import LogoWalletconnect from '@onekeyhq/kit/assets/onboarding/logo_walletconnect.png';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useOnboardingDone } from '../../../../hooks/useOnboardingRequired';
import { wait } from '../../../../utils/helper';
import { useAddExternalAccount } from '../../../ExternalAccount/useAddExternalAccount';
import { useConnectExternalWallet } from '../../../ExternalAccount/useConnectExternalWallet';

export function ConnectThirdPartyWallet({ onPress }: { onPress: () => void }) {
  const intl = useIntl();
  const { addExternalAccount } = useAddExternalAccount();
  const onboardingDone = useOnboardingDone();

  const onConnectResult = useCallback(
    async (result) => {
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

  const logos = [LogoMetaMask, LogoTrustWallet, LogoRainbow, LogoWalletconnect];

  return (
    <Pressable
      flexDirection={{ base: 'row' }}
      alignItems={{ base: 'center' }}
      justifyContent={{ base: 'center' }}
      mt={{ base: 6, sm: 0 }}
      py={{ base: 0 }}
      bg="transparent"
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      onPress={() => {
        if (platformEnv.isNativeAndroid) {
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
        Connect 3rd-Party Wallet
      </Text>
      <Box
        flexDirection={{ base: 'row' }}
        alignItems={{ base: 'center' }}
        mx={2}
      >
        {logos.map((logo, index) => (
          <Image key={index} source={logo} size={4} mx={0.5} rounded="sm" />
        ))}
        <Box bg="surface-neutral-default" rounded="sm" mx={0.5}>
          <Icon name="EllipsisHorizontalMini" size={16} color="icon-default" />
        </Box>
      </Box>
      <Box py={0.5}>
        <Icon name="ChevronRightMini" size={16} color="icon-subdued" />
      </Box>
    </Pressable>
  );
}
