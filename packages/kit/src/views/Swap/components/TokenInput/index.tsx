import React, { ComponentProps, FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  NumberInput,
  Pressable,
  Token,
  Typography,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { setHaptics } from '@onekeyhq/kit/src/hooks/setHaptics';

import {
  useAccountTokensBalance,
  useActiveWalletAccount,
} from '../../../../hooks';
import { Token as TokenType } from '../../../../store/typings';
import { useSwapActionHandlers } from '../../hooks/useSwap';

type TokenInputProps = {
  type: 'INPUT' | 'OUTPUT';
  token?: TokenType;
  tokenNetwork?: Network | null;
  label?: string;
  inputValue?: string;
  onPress?: () => void;
  onChange?: (text: string) => void;
  containerProps?: ComponentProps<typeof Box>;
  showMax?: boolean;
  isDisabled?: boolean;
};

const TokenInput: FC<TokenInputProps> = ({
  label,
  inputValue,
  onPress,
  token,
  tokenNetwork,
  onChange,
  containerProps,
  type,
  showMax,
  isDisabled,
}) => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const balances = useAccountTokensBalance(tokenNetwork?.id ?? '', accountId);
  const { onUserInput } = useSwapActionHandlers();
  const value = token ? balances[token?.tokenIdOnNetwork || 'main'] : '0';
  const onMax = useCallback(() => {
    if (!token || !value) {
      return;
    }
    if (token.tokenIdOnNetwork) {
      onUserInput(type, value);
    } else {
      const v = Math.max(0, Number(value) - 0.1);
      if (v > 0) {
        onUserInput(type, String(v));
      }
    }
  }, [token, value, onUserInput, type]);
  let text = Number(value).toFixed(6);
  if (!value || Number(value) === 0 || Number.isNaN(+value)) {
    text = '0';
  }
  return (
    <Box px={2} {...containerProps} position="relative">
      <Box position="relative">
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-end"
        >
          <Box flex="1">
            <NumberInput
              w="full"
              h="auto"
              borderWidth={0}
              placeholder="0.00"
              fontSize={24}
              fontWeight="bold"
              bg="transparent"
              _disabled={{ bg: 'transparent' }}
              _hover={{ bg: 'transparent' }}
              _focus={{ bg: 'transparent' }}
              value={inputValue}
              borderRadius={0}
              onChangeText={onChange}
              pt="9"
              pb="1"
              pl={2}
              isDisabled={isDisabled}
            />
          </Box>
          <Pressable
            onPress={() => {
              if (isDisabled) {
                return;
              }
              setHaptics();
              if (onPress) onPress();
            }}
            flexDirection="row"
            alignItems="center"
            _hover={{ bg: 'surface-hovered' }}
            _pressed={{ bg: 'surface-pressed' }}
            borderRadius={12}
            p={2}
          >
            {token && (
              <Box mr={3} position="relative">
                <Token size="6" src={token.logoURI} />
                {tokenNetwork ? (
                  <Box
                    position="absolute"
                    right="-4"
                    top="-4"
                    w="18px"
                    h="18px"
                    bg="surface-subdued"
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    borderRadius="full"
                  >
                    <Token size="4" src={tokenNetwork?.logoURI} />
                  </Box>
                ) : null}
              </Box>
            )}
            <Typography.Body1>
              {token
                ? token.symbol
                : intl.formatMessage({ id: 'title__select_a_token' })}
            </Typography.Body1>
            <Center w="5" h="5" ml={1}>
              <Icon size={20} name="ChevronDownSolid" />
            </Center>
          </Pressable>
        </Box>
        <Box position="absolute" top="0" w="full">
          <Typography.Body2
            color="text-subdued"
            p={2}
            position="absolute"
            left="0"
            top="0"
          >
            {label}
          </Typography.Body2>
          <Pressable
            onPress={() => {
              if (isDisabled || !showMax) {
                return;
              }
              setHaptics();
              onMax();
            }}
            p={2}
            rounded="xl"
            _hover={{ bg: 'surface-hovered' }}
            _pressed={{ bg: 'surface-pressed' }}
            right="0"
            top="0"
            position="absolute"
          >
            <Box flexDirection="row" alignItems="center">
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage(
                  { id: 'content__balance_str' },
                  { '0': text },
                )}
              </Typography.Body2>
              {showMax && Number(value) > 0 ? (
                <Typography.Body2 color="text-success" ml="2">
                  {intl.formatMessage({ id: 'action__max' })}
                </Typography.Body2>
              ) : null}
            </Box>
          </Pressable>
        </Box>
      </Box>
    </Box>
  );
};

export default TokenInput;
