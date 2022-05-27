import React, { FC, useCallback } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { chunk } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Modal,
  Pressable,
  ScrollView,
  useToast,
} from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { useSafeAreaInsets } from '@onekeyhq/components/src/Provider/hooks';
import { Text } from '@onekeyhq/components/src/Typography';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import { setHaptics } from '@onekeyhq/kit/src/hooks/setHaptics';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../hooks';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '../../../routes/Modal/CreateWallet';
import { setEnableLocalAuthentication } from '../../../store/reducers/settings';
import { wait } from '../../../utils/helper';
import { savePassword } from '../../../utils/localAuthentication';

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
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const words = mnemonic.split(' ').filter(Boolean);
  const halfWords = words.length / 2;

  const copyMnemonicToClipboard = useCallback(
    (text) => {
      if (!text) return;
      copyToClipboard(text);
      toast.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    },
    [toast, intl],
  );
  return (
    <Modal footer={null}>
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
          <Pressable
            maxH="full"
            px={4}
            py={{ base: 2, md: 2.5 }}
            bg="surface-default"
            _hover={{ bg: 'surface-hovered' }}
            _pressed={{ bg: 'surface-pressed' }}
            shadow="depth.2"
            borderRadius="12"
            onPress={() => {
              setHaptics();
              copyMnemonicToClipboard(mnemonic);
            }}
          >
            <ScrollView>
              <Box flexDirection="row">
                {chunk(words, halfWords).map((wordsInChunk, chunkIndex) => (
                  <Box
                    key={chunkIndex}
                    flex="1"
                    mr={chunkIndex === 0 ? 6 : undefined}
                  >
                    {wordsInChunk.map((word, i) => (
                      <Box key={i} flexDirection="row" my={1.5}>
                        <Text
                          typography={{
                            sm: 'Body1Strong',
                            md: 'Body2Strong',
                          }}
                          color="text-subdued"
                          w="8"
                        >
                          {i + chunkIndex * halfWords + 1}.
                        </Text>
                        <Text
                          typography={{
                            sm: 'Body1Strong',
                            md: 'Body2Strong',
                          }}
                          color="text-default"
                        >
                          {word}
                        </Text>
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </ScrollView>
          </Pressable>
        </Box>
        <Button
          size="xl"
          type="primary"
          mt="auto"
          mb={insets.bottom}
          onPress={onPress}
          onPromise={onPromise}
        >
          {intl.formatMessage({ id: 'action__i_have_saved_the_phrase' })}
        </Button>
      </Box>
    </Modal>
  );
};

const MnemonicContainer = () => {
  const route = useRoute<RouteProps>();
  const { mnemonic, password, withEnableAuthentication } = route.params ?? {};
  const toast = useToast();
  const intl = useIntl();
  const { closeDrawer, resetToRoot } = useNavigationActions();
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
      toast.show({ title: intl.formatMessage({ id: 'msg__account_created' }) });
    } catch (e) {
      const errorKey = (e as { key: LocaleIds }).key;
      toast.show({ title: intl.formatMessage({ id: errorKey }) });
    }
    closeDrawer();
    await wait(600);
    resetToRoot();
    await wait(600);
    if (platformEnv.isExtensionUiStandaloneWindow) {
      window?.close?.();
    }
  }, [
    mnemonic,
    password,
    withEnableAuthentication,
    closeDrawer,
    intl,
    toast,
    resetToRoot,
  ]);
  return <Mnemonic mnemonic={mnemonic} onPromise={onPromise} />;
};

export default MnemonicContainer;
