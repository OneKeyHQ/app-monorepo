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
import { setHaptics } from '@onekeyhq/kit/src/hooks/setHaptics';

import { useManageTokens } from '../../../../hooks/useManageTokens';
import { Token as TokenType } from '../../../../store/typings';
import { useSwapActionHandlers } from '../../hooks/useSwap';

type TokenInputProps = {
  type: 'INPUT' | 'OUTPUT';
  token?: TokenType;
  label?: string;
  inputValue?: string;
  onPress?: () => void;
  onChange?: (text: string) => void;
  containerProps?: ComponentProps<typeof Box>;
  showMax?: boolean;
};

const TokenInput: FC<TokenInputProps> = ({
  label,
  inputValue,
  onPress,
  token,
  onChange,
  containerProps,
  type,
}) => {
  const intl = useIntl();
  const { balances } = useManageTokens();
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
    <Box px={2} {...containerProps}>
      <Box display="flex" flexDirection="row" justifyContent="space-between">
        <Typography.Body2 color="text-subdued" p={2}>
          {label}
        </Typography.Body2>
        <Pressable
          onPress={() => {
            setHaptics();
            onMax();
          }}
          p={2}
          rounded="xl"
          _hover={{ bg: 'surface-hovered' }}
          _pressed={{ bg: 'surface-pressed' }}
        >
          <Box flexDirection="row" alignItems="center">
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage(
                { id: 'content__balance_str' },
                { '0': text },
              )}
            </Typography.Body2>
          </Box>
        </Pressable>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box flex="1">
          <NumberInput
            w="full"
            size="xl"
            borderWidth={0}
            placeholder="0.00"
            fontSize={24}
            fontWeight="bold"
            bg="transparent"
            _hover={{ bg: 'transparent' }}
            _focus={{ bg: 'transparent' }}
            defaultValue=""
            value={inputValue}
            borderRadius={0}
            onChangeText={onChange}
            pt="0"
            pb="0"
            pl={2}
            h={10}
          />
        </Box>
        <Pressable
          onPress={() => {
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
            <Box mr={3}>
              <Token size="6" src={token.logoURI} />
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
    </Box>
  );
};

export default TokenInput;
