import type { ComponentProps, FC, ReactElement } from 'react';
import { useCallback, useEffect, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet, View } from 'react-native';

import {
  Box,
  CustomSkeleton,
  Icon,
  NumberInput,
  Pressable,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';
import type { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { FormatCurrency } from '../../../../components/Format';
import { useAppSelector, useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { setRecipient } from '../../../../store/reducers/swap';
import { useTokenBalance, useTokenPrice } from '../../hooks/useSwapTokenUtils';
import { SwapRoutes } from '../../typings';
import { formatAmount } from '../../utils';
import { NetworkName } from '../NetworkName';
import { TokenDisplay } from '../TokenDisplay';

import type { Token as TokenType } from '../../../../store/typings';

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

const TokenInputReceivingAddress: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const outputTokenNetwork = useAppSelector((s) => s.swap.outputTokenNetwork);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const recipient = useAppSelector((s) => s.swap.recipient);
  const [tooltip, setTooltip] = useState<string | undefined>();
  const [recipientUnknown, setRecipientUnknown] = useState<boolean>(false);
  const borderBottomColor = useThemeValue('surface-neutral-default');

  const onPress = useCallback(() => {
    setTooltip(undefined);
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.PickRecipient,
        params: {
          networkId: outputTokenNetwork?.id,
          onSelected: ({
            address: selectedAddress,
            name: selectedName,
            accountId,
          }) => {
            backgroundApiProxy.dispatch(
              setRecipient({
                address: selectedAddress,
                name: selectedName,
                networkId: outputTokenNetwork?.id,
                networkImpl: outputTokenNetwork?.impl,
                accountId,
              }),
            );
          },
        },
      },
    });
  }, [navigation, outputTokenNetwork?.id, outputTokenNetwork?.impl]);

  useEffect(() => {
    async function main() {
      let isDirty = false;
      async function checkRecipientUnknown() {
        const isUnknown =
          await backgroundApiProxy.serviceSwap.recipientIsUnknown(recipient);
        setRecipientUnknown(isUnknown);
        if (isUnknown) {
          const shown =
            await backgroundApiProxy.serviceSwap.getSwapReceivingUnknownShown();
          if (shown) {
            return;
          }
          await backgroundApiProxy.serviceSwap.setSwapReceivingUnknownShown(
            true,
          );
          setTooltip(
            intl.formatMessage({
              id: 'msg__you_are_swapping_asset_to_an_address_that_may_not_be_yours_please_verify',
            }),
          );
          isDirty = true;
        }
      }
      async function checkReceivingNotMatched() {
        if (
          sendingAccount?.address &&
          recipient?.address &&
          sendingAccount?.address !== recipient?.address
        ) {
          const shown =
            await backgroundApiProxy.serviceSwap.getSwapReceivingIsNotSendingAccountShown();
          if (shown) {
            return;
          }

          await backgroundApiProxy.serviceSwap.setSwapReceivingIsNotSendingAccountShown(
            true,
          );
          setTooltip(
            intl.formatMessage({
              id: 'msg__you_have_selected_another_account_to_receive_tokens',
            }),
          );
        }
      }
      await checkRecipientUnknown();
      if (!isDirty) {
        await checkReceivingNotMatched();
      }
    }
    main();
  }, [sendingAccount, recipient, intl]);

  useEffect(() => {
    if (tooltip) {
      const timer = setTimeout(() => setTooltip(undefined), 8000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [tooltip]);

  let text: ReactElement | undefined;

  useFocusEffect(useCallback(() => () => setTooltip(undefined), []));

  const { address, name } = recipient ?? {};
  if (address && name) {
    text = (
      <Box mr="1" flexDirection="row">
        <Typography.Body2Strong
          mr="1"
          color={recipientUnknown ? 'text-warning' : 'text-default'}
        >
          {name}
        </Typography.Body2Strong>
        <Typography.Body2
          color={recipientUnknown ? 'text-warning' : 'text-subdued'}
        >
          {address.slice(-4)}
        </Typography.Body2>
      </Box>
    );
  } else if (address) {
    text = (
      <Box mr="1">
        <Typography.Body2
          color={recipientUnknown ? 'text-warning' : 'text-subdued'}
        >
          {intl.formatMessage({ id: 'form__unknown' })}{' '}
          {shortenAddress(address)}
        </Typography.Body2>
      </Box>
    );
  }

  if (address) {
    return (
      <Box position="relative">
        <Box flexDirection="row">
          <Pressable
            flexDirection="row"
            borderRadius={12}
            alignItems="center"
            onPress={onPress}
            _hover={{ bg: 'surface-hovered' }}
            _pressed={{ bg: 'surface-pressed' }}
            position="relative"
          >
            <Box py="1" px="2" flexDirection="row" alignItems="center">
              {text}
              <Icon size={16} name="ChevronDownSolid" />
            </Box>
          </Pressable>
        </Box>
        {tooltip ? (
          <Box position="relative">
            <View style={{ height: StyleSheet.hairlineWidth, width: 210 }} />
            <Box
              position="absolute"
              zIndex={1}
              top="2"
              left="1"
              bg="surface-neutral-default"
              borderRadius={12}
              width="56"
            >
              <Box
                style={{
                  width: 0,
                  height: 0,
                  backgroundColor: 'transparent',
                  borderStyle: 'solid',
                  borderLeftWidth: 5,
                  borderRightWidth: 5,
                  borderBottomWidth: 10,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderBottomColor,
                  position: 'absolute',
                  top: -10,
                  left: 14,
                }}
              />
              <Box p="3">
                <Typography.Body2>{tooltip}</Typography.Body2>
              </Box>
            </Box>
          </Box>
        ) : null}
      </Box>
    );
  }
  return (
    <Pressable flexDirection="row" alignItems="center" onPress={onPress}>
      <Box
        flexDirection="row"
        py="1"
        px="2"
        // bg="surface-neutral-subdued"
        borderRadius="12"
      >
        <Typography.Caption color="text-default" mr="1" numberOfLines={1}>
          {intl.formatMessage({ id: 'title__choose_an_account' })}
        </Typography.Caption>
      </Box>
    </Pressable>
  );
};

const TokenInput: FC<TokenInputProps> = ({
  inputValue,
  onPress,
  token,
  onChange,
  containerProps,
  isDisabled,
}) => {
  const intl = useIntl();
  const price = useTokenPrice(token);
  const recipient = useAppSelector((s) => s.swap.recipient);
  const balance = useTokenBalance(token, recipient?.accountId);
  const loading = useAppSelector((s) => s.swap.loading);
  const independentField = useAppSelector((s) => s.swap.independentField);
  const value = balance ?? '0';
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
          zIndex={1}
        >
          <TokenInputReceivingAddress />
          <Pressable
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
            {independentField === 'INPUT' && loading ? (
              <Box
                minH="12"
                h="full"
                flexDirection="row"
                justifyContent="flex-end"
                alignItems="center"
              >
                <Box h="4" width="24" borderRadius="2px" overflow="hidden">
                  <CustomSkeleton />
                </Box>
              </Box>
            ) : (
              <Box position="absolute" w="full" top="0" right="0">
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
                  // pt="1.5"
                  pr="2"
                  pb="12"
                  textAlign="right"
                  isDisabled={isDisabled}
                  rightCustomElement={null}
                  focusOutlineColor="transparent"
                />
              </Box>
            )}
          </Box>
        </Box>
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          zIndex="-1"
          mt="2"
          px={2}
        >
          <NetworkName networkId={token?.networkId} />
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
