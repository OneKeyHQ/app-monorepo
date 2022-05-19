import React, { FC, useCallback, useEffect, useState } from 'react';

import { useNavigation } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Icon,
  Image,
  Input,
  Keyboard,
  Modal,
  Pressable,
  Spinner,
  Text,
} from '@onekeyhq/components';
import MoonpayIMG from '@onekeyhq/kit/assets/MoonPay.png';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  FiatPayModalRoutesParams,
  FiatPayRoutes,
} from '../../../routes/Modal/FiatPay';

import { NativeText } from './NativeText';

type NavigationProps = ModalScreenProps<FiatPayModalRoutesParams>;

function checkInputVaild(text: string) {
  const asciiCode = text.charCodeAt(0);
  return (
    (asciiCode >= '0'.charCodeAt(0) && asciiCode <= '9'.charCodeAt(0)) ||
    asciiCode === '.'.charCodeAt(0)
  );
}

export const AmountInput: FC = () => {
  const intl = useIntl();
  const [inputText, updateInputText] = useState('150');
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation<NavigationProps['navigation']>();

  const onChangeText = useCallback((text: string) => {
    updateInputText((prev) => {
      if (text.length > prev.length) {
        if (checkInputVaild(text.slice(text.length - 1, text.length))) {
          const result = new BigNumber(text);
          if (!result.isNaN()) {
            return text;
          }
          return text.slice(0, text.length - 1);
        }
        return prev;
      }
      return text;
    });
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  }, []);

  return (
    <Modal
      height="500px"
      header="Buy Bitcoin"
      headerDescription="1FmxQ5...yBjK"
      hideSecondaryAction
      footer={null}
    >
      <Box flex={1} justifyContent="space-between">
        <Box flex={1} flexDirection="column" justifyContent="center">
          <Text
            textAlign="center"
            typography={{ sm: 'DisplaySmall', md: 'Body1Strong' }}
            color="text-subdued"
          >
            USD
          </Text>
          <Center flex={1}>
            {platformEnv.isNative ? (
              <NativeText text={inputText} />
            ) : (
              <Input
                size="xl"
                textAlign="center"
                borderWidth="0"
                fontSize="42px"
                placeholder="Amount"
                placeholderTextColor="text-disabled"
                lineHeight="72px"
                fontWeight="700"
                bgColor="surface-subdued"
                multiline
                onChangeText={(text) => {
                  onChangeText(text);
                }}
                onContentSizeChange={(e) => {
                  console.log('contentSize = ', e.nativeEvent.contentSize);
                }}
                value={inputText}
              />
            )}
          </Center>
          {loading ? (
            <Spinner size="sm" />
          ) : (
            <Text typography="DisplaySmall" textAlign="center">
              ≈ 0.03802 BTC
            </Text>
          )}
        </Box>

        <Box paddingBottom="24px">
          <Pressable
            mt="24px"
            height="76px"
            padding="16px"
            bgColor="surface-default"
            mb="24px"
            borderRadius="12px"
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
            disabled
          >
            <Image
              borderRadius="12px"
              width="40px"
              height="40px"
              source={MoonpayIMG}
            />
            <Box flex={1} flexDirection="column" ml="12px">
              <Text typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}>
                MoonPay
              </Text>
              <Text typography="Body2" color="text-subdued">
                Third Party Provider
              </Text>
            </Box>

            <Icon name="ChevronRightSolid" size={20} />
          </Pressable>
          {platformEnv.isNative ? (
            <Keyboard
              onKeyPress={(key) => {
                updateInputText((prev) => {
                  const result = new BigNumber(prev + key);
                  if (!result.isNaN()) {
                    return prev + key;
                  }
                  return prev;
                });
              }}
              onDelete={() => {
                updateInputText((prev) => {
                  const result = prev.slice(0, prev.length - 1);
                  if (result.slice(result.length - 1, result.length) === '.') {
                    return result.slice(0, result.length - 1);
                  }
                  return result;
                });
              }}
            />
          ) : null}
          <Button
            type="primary"
            size="xl"
            // isDisabled
            mt={platformEnv.isNative ? '24px' : '0px'}
            onPress={() => {
              navigation.navigate(FiatPayRoutes.MoonpayWebViewModal, {
                url: 'https://buy-sandbox.moonpay.com?apiKey=pk_test_Zi6NCCoN2Bp1DaRUQ4P4pKi9b2VEkTp',
              });
            }}
          >
            {intl.formatMessage({
              id: 'action__next',
            })}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default AmountInput;
