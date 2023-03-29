import type { FC } from 'react';
import { useCallback } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  MnemonicCard,
  Modal,
  Text,
  ToastManager,
} from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../hooks';
import { closeExtensionWindowIfOnboardingFinished } from '../../../hooks/useOnboardingRequired';
import { setEnableLocalAuthentication } from '../../../store/reducers/settings';
import { wait } from '../../../utils/helper';
import { savePassword } from '../../../utils/localAuthentication';

import type { CreateWalletRoutesParams } from '../../../routes';
import type { CreateWalletModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.MnemonicModal
>;

type MnemonicProps = {
  mnemonic: string;
  onPress?: () => void;
  onPromise?: () => Promise<void>;
};

export const Mnemonic: FC<MnemonicProps> = ({
  mnemonic,
  onPress,
  onPromise,
}) => {
  const intl = useIntl();

  return (
    <Modal
      hideSecondaryAction
      primaryActionProps={{
        onPress,
        onPromise,
        children: intl.formatMessage({ id: 'action__i_have_saved_the_phrase' }),
      }}
      scrollViewProps={{
        children: (
          <Box flex={1} px={{ base: 2, md: 0 }}>
            <Box mb={{ base: 12, md: 8 }} px={2}>
              <Text
                typography={{ sm: 'DisplayLarge', md: 'DisplayMedium' }}
                mb="3"
                textAlign="center"
              >
                👀 {intl.formatMessage({ id: 'modal__for_your_eyes_only' })}
              </Text>
              <Text
                typography={{ sm: 'Body1', md: 'Body2' }}
                color="text-subdued"
                textAlign="center"
                maxW={{ md: 276 }}
                mx="auto"
              >
                {intl.formatMessage({ id: 'modal__for_your_eyes_only_desc' })}
              </Text>
            </Box>
            <Text
              typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
              mb="4"
              textAlign="center"
            >
              ↓ {intl.formatMessage({ id: 'content__click_below_to_copy' })} ↓
            </Text>
            <Box flex={1} mb={8}>
              <MnemonicCard mnemonic={mnemonic} />
            </Box>
          </Box>
        ),
      }}
    />
  );
};

export const MnemonicContainer = () => {
  const route = useRoute<RouteProps>();
  const { mnemonic, password, withEnableAuthentication } = route.params ?? {};

  const intl = useIntl();
  const { closeWalletSelector, openRootHome } = useNavigationActions();
  const onPromise = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceAccount.createHDWallet({
        password,
        mnemonic,
      });
      if (withEnableAuthentication) {
        backgroundApiProxy.dispatch(setEnableLocalAuthentication(true));
        await savePassword(password);
      }
      ToastManager.show({
        title: intl.formatMessage({ id: 'msg__account_created' }),
      });
    } catch (e) {
      const errorKey = (e as { key: LocaleIds }).key;
      ToastManager.show({ title: intl.formatMessage({ id: errorKey }) });
    }
    closeWalletSelector();
    await wait(600);
    openRootHome();
    await wait(600);
    closeExtensionWindowIfOnboardingFinished();
  }, [
    mnemonic,
    password,
    withEnableAuthentication,
    closeWalletSelector,
    intl,

    openRootHome,
  ]);
  return <Mnemonic mnemonic={mnemonic} onPromise={onPromise} />;
};
