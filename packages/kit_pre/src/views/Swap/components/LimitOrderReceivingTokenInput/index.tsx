import type { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import { Box, NumberInput, Pressable, Typography } from '@onekeyhq/components';

import { FormatCurrency } from '../../../../components/Format';
import { useAppSelector } from '../../../../hooks';
import { useTokenPrice } from '../../hooks/useSwapTokenUtils';
import { TokenDisplay } from '../TokenDisplay';

type TokenInputProps = {
  type: 'INPUT' | 'OUTPUT';
  label?: string;
  inputValue?: string;
  onPress?: () => void;
  onChange?: (text: string) => void;
  containerProps?: ComponentProps<typeof Box>;
  isDisabled?: boolean;
};

const TokenInput: FC<TokenInputProps> = ({
  inputValue,
  onPress,
  onChange,
  containerProps,
  isDisabled,
}) => {
  const intl = useIntl();
  const token = useAppSelector((s) => s.limitOrder.tokenOut);
  const price = useTokenPrice(token);

  return (
    <Box {...containerProps} position="relative">
      <Box position="relative">
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-start"
          mt="1"
        >
          <Pressable
            onPress={() => {
              if (isDisabled) {
                return;
              }
              onPress?.();
            }}
            flexDirection="row"
            alignItems="center"
            _hover={{ bg: 'surface-hovered' }}
            _pressed={{ bg: 'surface-pressed' }}
            borderRadius={12}
            p="2"
          >
            {token ? (
              <TokenDisplay token={token} />
            ) : (
              <Box>
                <Typography.DisplayMedium fontWeight={600}>
                  {intl.formatMessage({ id: 'title__select_a_token' })}
                </Typography.DisplayMedium>
              </Box>
            )}
          </Pressable>
          <Box
            flex="1"
            flexDirection="row"
            h="full"
            justifyContent="flex-end"
            position="relative"
          >
            <Box position="absolute" w="full" top="0" right="0">
              <Box w="full" position="relative">
                <Box position="absolute" bottom="7" right={2}>
                  <Box pointerEvents="none">
                    <Typography.Caption color="text-subdued" numberOfLines={2}>
                      <FormatCurrency
                        numbers={[price ?? 0, inputValue ?? 0]}
                        render={(ele) => (
                          <Typography.Caption ml={3} color="text-subdued">
                            {price ? ele : '-'}
                          </Typography.Caption>
                        )}
                      />
                    </Typography.Caption>
                  </Box>
                </Box>
                <NumberInput
                  w="full"
                  h="auto"
                  borderWidth={0}
                  placeholder="0.00"
                  fontSize={24}
                  fontWeight="600"
                  bg="transparent"
                  color="text-subdued"
                  _disabled={{ bg: 'transparent' }}
                  _hover={{ bg: 'transparent' }}
                  _focus={{ bg: 'transparent' }}
                  value={inputValue}
                  borderRadius={0}
                  onChangeText={onChange}
                  // pt="1.5"
                  pr="2"
                  pb="12"
                  textAlign="right"
                  isDisabled
                  rightCustomElement={null}
                  focusOutlineColor="transparent"
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TokenInput;
