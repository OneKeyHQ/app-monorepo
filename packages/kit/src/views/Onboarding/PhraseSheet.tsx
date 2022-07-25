import React, { FC } from 'react';

import { chunk } from 'lodash';
import { IBoxProps } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Pressable,
  ScrollView,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';

type PhraseSheetProps = {
  onPressSavedPhrase?: () => void;
} & IBoxProps;

const defaultProps = {} as const;

const PhraseSheet: FC<PhraseSheetProps> = ({ onPressSavedPhrase, ...rest }) => {
  const intl = useIntl();
  const words = [
    'word',
    'word',
    'word',
    'word',
    'word',
    'word',
    'word',
    'word',
    'word',
    'word',
    'word',
    'word',
  ];
  const halfWords = words.length / 2;
  const isVerticalLayout = useIsVerticalLayout();

  return (
    <>
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
            shadow="depth.2"
            borderRadius="12"
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
          onPress={onPressSavedPhrase}
        >
          {intl.formatMessage({ id: 'action__i_have_saved_the_phrase' })}
        </Button>
      </Box>
    </>
  );
};

PhraseSheet.defaultProps = defaultProps;

export default PhraseSheet;
