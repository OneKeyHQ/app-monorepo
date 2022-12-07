import React, { ComponentProps, FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  NumberInput,
  Pressable,
  Typography,
  useToast,
} from '@onekeyhq/components';
import { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { FormatCurrency } from '../../../../components/Format';
import { useCreateAccountInWallet } from '../../../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import {
  useActiveWalletAccount,
  useNavigation,
  useNetworkSimple,
} from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { setSendingAccount } from '../../../../store/reducers/swap';
import { Token as TokenType } from '../../../../store/typings';
import { tokenReservedValues } from '../../config';
import { useSwapQuoteCallback } from '../../hooks/useSwap';
import { useTokenBalance, useTokenPrice } from '../../hooks/useSwapTokenUtils';
import { SwapRoutes } from '../../typings';
import { formatAmount } from '../../utils';
import { TokenImage } from '../TokenImage';

type TokenInputProps = {
  type: 'INPUT' | 'OUTPUT';
  account?: Account | null;
  token?: TokenType;
  label?: string;
  inputValue?: string;
  onPress?: () => void;
  onChange?: (text: string) => void;
  containerProps?: ComponentProps<typeof Box>;
  isDisabled?: boolean;
};

type TokenAccountProps = {
  account?: Account | null;
  token?: TokenType;
};

const TokenInputSendingAccount: FC<TokenAccountProps> = ({
  account,
  token,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const onSwapQuote = useSwapQuoteCallback();
  const { walletId } = useActiveWalletAccount();

  const onPickAccount = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.PickAccount,
        params: {
          networkId: token?.networkId,
          onSelected: (acc) => {
            backgroundApiProxy.dispatch(setSendingAccount(acc));
            onSwapQuote();
          },
        },
      },
    });
  }, [token, onSwapQuote, navigation]);

  const { createAccount } = useCreateAccountInWallet({
    networkId: token?.networkId,
    walletId,
  });

  if (account === null) {
    return (
      <Pressable onPress={createAccount}>
        <Box
          py="1"
          px="2"
          flexDirection="row"
          bg="surface-neutral-subdued"
          borderRadius="12"
        >
          <Typography.CaptionStrong color="text-default">
            {intl.formatMessage({ id: 'action__create_account' })}
          </Typography.CaptionStrong>
        </Box>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPickAccount}>
      {!account ? (
        <Box py="1" px="2" bg="surface-neutral-subdued" borderRadius="12">
          <Typography.CaptionStrong color="text-default">
            {intl.formatMessage({ id: 'title__choose_an_account' })}
          </Typography.CaptionStrong>
        </Box>
      ) : (
        <Box py="1" px="2" bg="surface-neutral-subdued" borderRadius="12">
          <Typography.Caption color="text-default" mr="1" numberOfLines={1}>
            {`${account.name}(${account.address.slice(-4)})`}
          </Typography.Caption>
        </Box>
      )}
    </Pressable>
  );
};

const TokenInput: FC<TokenInputProps> = ({
  label,
  inputValue,
  onPress,
  account,
  token,
  onChange,
  containerProps,
  type,
  isDisabled,
}) => {
  const intl = useIntl();
  const toast = useToast();
  const tokenNetwork = useNetworkSimple(token?.networkId);

  const balance = useTokenBalance(token, account?.id);
  const price = useTokenPrice(token);
  const value = balance ?? '0';
  const onMax = useCallback(() => {
    if (!token || !value) {
      return;
    }
    if (token.tokenIdOnNetwork || tokenNetwork?.impl !== 'evm') {
      backgroundApiProxy.serviceSwap.userInput(type, value);
    } else {
      const reserved = tokenReservedValues[token.networkId] ?? 0.1;
      const v = Math.max(0, Number(value) - reserved);
      if (v > 0) {
        backgroundApiProxy.serviceSwap.userInput(type, String(v));
      } else if (Number(value) > 0) {
        toast.show({
          title: intl.formatMessage({
            id: 'msg__current_token_balance_is_insufficient',
          }),
        });
      }
    }
  }, [token, value, type, toast, intl, tokenNetwork]);
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
          <Typography.Caption p="2" color="text-default" fontWeight={500}>
            {label}
          </Typography.Caption>
          <TokenInputSendingAccount account={account} token={token} />
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
              <TokenImage token={token} />
            ) : (
              <Box>
                <Typography.DisplayMedium fontWeight={600}>
                  {intl.formatMessage({ id: 'title__select_a_token' })}
                </Typography.DisplayMedium>
              </Box>
            )}
            <Center w="5" h="5">
              <Icon size={20} name="ChevronDownMini" color="icon-subdued" />
            </Center>
          </Pressable>
          <Box
            flex="1"
            flexDirection="row"
            h="full"
            justifyContent="flex-end"
            position="relative"
          >
            <Box position="absolute" w="full" top="0" right="0">
              <NumberInput
                w="full"
                h="auto"
                borderWidth={0}
                placeholder="0.00"
                fontSize={24}
                fontWeight="600"
                fontFamily="PlusJakartaSans-SemiBold"
                bg="transparent"
                _disabled={{ bg: 'transparent' }}
                _hover={{ bg: 'transparent' }}
                _focus={{ bg: 'transparent' }}
                value={inputValue}
                borderRadius={0}
                onChangeText={onChange}
                pt="3"
                pb="12"
                focusOutlineColor="transparent"
                // py="1"
                pr="2"
                textAlign="right"
                isDisabled={isDisabled}
                rightCustomElement={null}
              />
            </Box>
          </Box>
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          zIndex="-1"
        >
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
              <Box
                h="4"
                w="8"
                ml="1"
                justifyContent="center"
                alignItems="center"
                borderRadius={4}
                backgroundColor="surface-neutral-default"
              >
                <Typography.Caption color="text-default">
                  {intl.formatMessage({ id: 'action__max' })}
                </Typography.Caption>
              </Box>
            </Box>
          </Pressable>
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
      </Box>
    </Box>
  );
};

export default TokenInput;
