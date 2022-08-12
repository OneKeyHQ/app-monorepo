import React, { ComponentProps, FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  NumberInput,
  Pressable,
  Token as TokenImage,
  Typography,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import {
  useAccountTokensBalance,
  useActiveWalletAccount,
} from '../../../../hooks';
import { Token as TokenType } from '../../../../store/typings';
import { Chains } from '../../config';
import { formatAmount, getChainIdFromNetworkId } from '../../utils';

type TokenInputProps = {
  type: 'INPUT' | 'OUTPUT';
  token?: TokenType;
  tokenNetwork?: Network | null;
  label?: string;
  inputValue?: string;
  onPress?: () => void;
  onChange?: (text: string) => void;
  containerProps?: ComponentProps<typeof Box>;
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
  isDisabled,
}) => {
  const intl = useIntl();
  const { accountId } = useActiveWalletAccount();
  const balances = useAccountTokensBalance(tokenNetwork?.id ?? '', accountId);
  const value = token ? balances[token?.tokenIdOnNetwork || 'main'] : '0';
  const onMax = useCallback(() => {
    if (!token || !value) {
      return;
    }
    if (token.tokenIdOnNetwork) {
      backgroundApiProxy.serviceSwap.userInput(type, value);
    } else {
      const chainId = getChainIdFromNetworkId(token.networkId);
      let minuend = 0.1;
      if (chainId === Chains.MAINNET || chainId === Chains.BSC) {
        minuend = 0.01;
      } else if (chainId === Chains.POLYGON) {
        minuend = 0.03;
      }
      const v = Math.max(0, Number(value) - minuend);
      if (v > 0) {
        backgroundApiProxy.serviceSwap.userInput(type, String(v));
      }
    }
  }, [token, value, type]);
  let text = formatAmount(value, 6);
  if (!value || Number(value) === 0 || Number.isNaN(+value)) {
    text = '0';
  }
  return (
    <Box {...containerProps} position="relative">
      <Box position="relative">
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography.Caption p="2" color="text-subdued" fontWeight={500}>
            {label}
          </Typography.Caption>
          <Pressable
            onPress={() => {
              if (isDisabled) {
                return;
              }
              onMax();
            }}
            rounded="xl"
            _hover={{ bg: 'surface-hovered' }}
            _pressed={{ bg: 'surface-pressed' }}
            p="2"
          >
            <Box flexDirection="row" alignItems="center">
              <Typography.Caption color="text-subdued" fontWeight={500}>
                {token ? `${text} ${token.symbol.toUpperCase()}` : '-'}
              </Typography.Caption>
            </Box>
          </Pressable>
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
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
            {token && tokenNetwork ? (
              <Box flexDirection="row" alignItems="center">
                <Box mr="2">
                  <TokenImage size={8} src={token.logoURI} />
                </Box>
                <Box>
                  <Typography.DisplayMedium fontWeight={600}>
                    {token.symbol.toUpperCase()}
                  </Typography.DisplayMedium>
                  <Typography.Caption color="text-subdued" fontWeight={500}>
                    {tokenNetwork.shortName}
                  </Typography.Caption>
                </Box>
              </Box>
            ) : (
              <Box>
                <Typography.DisplayMedium fontWeight={600}>
                  {intl.formatMessage({ id: 'title__select_a_token' })}
                </Typography.DisplayMedium>
              </Box>
            )}
            <Center w="5" h="5">
              <Icon size={20} name="ChevronDownSolid" />
            </Center>
          </Pressable>
          <Box flex="1" flexDirection="row" justifyContent="flex-end">
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
              py="1"
              pr="0"
              textAlign="right"
              isDisabled={isDisabled}
              rightCustomElement={null}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TokenInput;
