import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { chunk } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Pressable,
  ScrollView,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';

import { wait } from '../../../../utils/helper';

import type { IBoxProps } from 'native-base';

type PhraseSheetProps = {
  onPressSavedPhrase?: () => void;
  mnemonic: string;
} & IBoxProps;

const defaultProps = {} as const;

const PhraseSheet: FC<PhraseSheetProps> = ({
  onPressSavedPhrase,
  mnemonic,
  ...rest
}) => {
  const intl = useIntl();

  const words = useMemo(
    () => mnemonic.split(' ').map((item) => item.trim()),
    [mnemonic],
  );
  const halfWords = words.length / 2;
  const isVerticalLayout = useIsVerticalLayout();

  const copyMnemonicToClipboard = useCallback(
    (text) => {
      if (!text) return;
      copyToClipboard(text);
      ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
    },
    [intl],
  );

  const onPressSavedPhrasePromise = useCallback(async () => {
    onPressSavedPhrase?.();
    await wait(3000);
  }, [onPressSavedPhrase]);

  return (
    <Box alignSelf="stretch" flex={1} {...rest}>
      <Text typography="Body2" color="text-subdued" textAlign="center" mb={4}>
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
          borderRadius="12"
          borderWidth={1}
          borderColor="divider"
          onPress={() => copyMnemonicToClipboard(mnemonic)}
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
      <Text typography="Body2" color="text-subdued" textAlign="center" mb={4}>
        {intl.formatMessage({ id: 'content__save_phrase_securely' })}
      </Text>
      <Button
        type="primary"
        size={isVerticalLayout ? 'xl' : 'base'}
        onPromise={onPressSavedPhrasePromise}
      >
        {intl.formatMessage({ id: 'action__i_have_saved_the_phrase' })}
      </Button>
    </Box>
  );
};

PhraseSheet.defaultProps = defaultProps;

export default PhraseSheet;
