import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  NumberInput,
  Pressable,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import type { Account } from '@onekeyhq/engine/src/types/account';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { FormatCurrency } from '../../../../components/Format';
import { useCreateAccountInWallet } from '../../../../components/NetworkAccountSelector/hooks/useCreateAccountInWallet';
import {
  useActiveWalletAccount,
  useAppSelector,
  useNavigation,
} from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { setActiveAccount } from '../../../../store/reducers/limitOrder';
import { useTokenBalance, useTokenPrice } from '../../hooks/useSwapTokenUtils';
import { SwapRoutes } from '../../typings';
import { formatAmount } from '../../utils';
import { TokenDisplay } from '../TokenDisplay';

import type { Token as TokenType } from '../../../../store/typings';

type TokenInputProps = {
  type: 'INPUT' | 'OUTPUT';
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
  const { walletId } = useActiveWalletAccount();

  const onPickAccount = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.PickAccount,
        params: {
          networkId: token?.networkId,
          onSelected: (acc) => {
            backgroundApiProxy.dispatch(setActiveAccount(acc));
          },
        },
      },
    });
  }, [token, navigation]);

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
    <Pressable
      borderRadius="12"
      overflow="hidden"
      onPress={onPickAccount}
      _hover={{ bg: 'surface-hovered' }}
      _pressed={{ bg: 'surface-pressed' }}
    >
      {!account ? (
        <Box py="1" px="2" borderRadius="12">
          <Typography.CaptionStrong color="text-default">
            {intl.formatMessage({ id: 'title__choose_an_account' })}
          </Typography.CaptionStrong>
        </Box>
      ) : (
        <Box
          py="1"
          px="2"
          flexDirection="row"
          borderRadius="12"
          alignItems="center"
        >
          <Box flexDirection="row" mr="1">
            <Typography.Body2Strong mr="1">
              {account.name}
            </Typography.Body2Strong>
            <Typography.Body2 color="text-subdued">
              {account.address.slice(-4)}
            </Typography.Body2>
          </Box>
          <Icon size={16} name="ChevronDownSolid" />
        </Box>
      )}
    </Pressable>
  );
};

const TokenInput: FC<TokenInputProps> = ({
  inputValue,
  onPress,
  onChange,
  containerProps,
  isDisabled,
}) => {
  const intl = useIntl();
  const token = useAppSelector((s) => s.limitOrder.tokenIn);
  const account = useAppSelector((s) => s.limitOrder.activeAccount);
  const balance = useTokenBalance(token, account?.id);
  const price = useTokenPrice(token);
  const value = balance ?? '0';
  const onMax = useCallback(async () => {
    if (!token || !value) {
      return;
    }
    if (token.tokenIdOnNetwork) {
      backgroundApiProxy.serviceLimitOrder.userInputValue(value);
    } else {
      const reserved =
        await backgroundApiProxy.serviceSwap.getReservedNetworkFee(
          token.networkId,
        );
      const v = BigNumber.max(0, new BigNumber(value).minus(reserved));
      if (v.gt(0)) {
        backgroundApiProxy.serviceLimitOrder.userInputValue(v.toFixed());
      } else if (Number(value) > 0) {
        ToastManager.show({
          title: intl.formatMessage({
            id: 'msg__current_token_balance_is_insufficient',
          }),
        });
      }
    }
  }, [token, value, intl]);
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
          <TokenInputSendingAccount account={account} token={token} />
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
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-start"
          mt="1"
        >
          <Pressable
            onPress={onPress}
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
                  _disabled={{ bg: 'transparent' }}
                  _hover={{ bg: 'transparent' }}
                  _focus={{ bg: 'transparent' }}
                  value={inputValue}
                  borderRadius={0}
                  onChangeText={onChange}
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
        </Box>
      </Box>
    </Box>
  );
};

export default TokenInput;
