import type { ComponentProps, FC, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useFocusEffect } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet, View } from 'react-native';

import {
  Box,
  CustomSkeleton,
  Icon,
  Image,
  NumberInput,
  Pressable,
  Switch,
  Typography,
  useThemeValue,
} from '@onekeyhq/components';
import { shortenAddress } from '@onekeyhq/components/src/utils';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { FormatCurrency } from '../../../../components/Format';
import { useAppSelector, useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import {
  setAllowAnotherRecipientAddress,
  setRecipient,
} from '../../../../store/reducers/swap';
import { useSwapRecipient } from '../../hooks/useSwap';
import { useTokenBalance, useTokenPrice } from '../../hooks/useSwapTokenUtils';
import { SwapRoutes } from '../../typings';
import {
  formatAmount,
  getNetworkIdImpl,
  recipientMustBeSendingAccount,
  shouldShowAllowRecipientAddressInput,
} from '../../utils';
import { TokenDisplay } from '../TokenDisplay';

import type { IQouterExtraData } from '../../quoter/socket';

type TokenInputProps = {
  type: 'INPUT' | 'OUTPUT';
  label?: string;
  inputValue?: string;
  onPress?: () => void;
  onChange?: (text: string) => void;
  containerProps?: ComponentProps<typeof Box>;
  isDisabled?: boolean;
  extraData?: IQouterExtraData;
};

const TokenInputReceivingAddress: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const outputTokenNetwork = useAppSelector((s) => s.swap.outputTokenNetwork);
  const sendingAccount = useAppSelector((s) => s.swap.sendingAccount);
  const recipient = useSwapRecipient();
  const [tooltip, setTooltip] = useState<string | undefined>();
  const [recipientUnknown, setRecipientUnknown] = useState<boolean>(false);
  const tooltipColor = useThemeValue('surface-neutral-default');

  const onPress = useCallback(() => {
    setTooltip(undefined);
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.SelectRecipient,
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
          maxW="120"
          isTruncated
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
        {tooltip ? (
          <Box position="relative">
            <View style={{ height: StyleSheet.hairlineWidth, width: 210 }} />
            <Box
              position="absolute"
              zIndex={1}
              bottom="2"
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
                  borderTopWidth: 10,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: tooltipColor,
                  position: 'absolute',
                  bottom: -10,
                  left: 14,
                }}
              />
              <Box p="3">
                <Typography.Body2>{tooltip}</Typography.Body2>
              </Box>
            </Box>
          </Box>
        ) : null}
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

const TokenInputReceivingAddressField = () => {
  const token = useAppSelector((s) => s.swap.outputToken);
  const recipient = useSwapRecipient();
  const balance = useTokenBalance(token, recipient?.accountId);
  const value = balance ?? '0';
  let text = formatAmount(value, 6);
  if (!value || Number(value) === 0 || Number.isNaN(+value)) {
    text = '0';
  }
  return (
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
  );
};

const TokenInputReceivingAddressFieldShowControl = () => {
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const allowAnotherRecipientAddress = useAppSelector(
    (s) => s.swap.allowAnotherRecipientAddress,
  );
  if (inputToken && outputToken) {
    const shouldBeSendingAccount = recipientMustBeSendingAccount(
      inputToken,
      outputToken,
      allowAnotherRecipientAddress,
    );
    if (!shouldBeSendingAccount) {
      return <TokenInputReceivingAddressField />;
    }
  }
  return null;
};

const SendToAnotherAddress = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const inputToken = useAppSelector((s) => s.swap.inputToken);
  const outputToken = useAppSelector((s) => s.swap.outputToken);
  const allowAnotherRecipientAddress = useAppSelector(
    (s) => s.swap.allowAnotherRecipientAddress,
  );
  const onToggle = useCallback(() => {
    const newValue = !allowAnotherRecipientAddress;
    if (newValue) {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Swap,
        params: {
          screen: SwapRoutes.SelectRecipient,
          params: {
            networkId: outputToken?.networkId,
            onSelected: ({
              address: selectedAddress,
              name: selectedName,
              accountId,
            }) => {
              backgroundApiProxy.dispatch(
                setRecipient({
                  address: selectedAddress,
                  name: selectedName,
                  networkId: outputToken?.networkId,
                  networkImpl: getNetworkIdImpl(outputToken?.networkId),
                  accountId,
                }),
              );
              backgroundApiProxy.dispatch(
                setAllowAnotherRecipientAddress(newValue),
              );
            },
          },
        },
      });
    } else {
      backgroundApiProxy.dispatch(setAllowAnotherRecipientAddress(newValue));
    }
  }, [allowAnotherRecipientAddress, outputToken, navigation]);
  if (inputToken && outputToken) {
    const showAllowRecipientAddressInput = shouldShowAllowRecipientAddressInput(
      inputToken,
      outputToken,
    );
    if (showAllowRecipientAddressInput) {
      return (
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          p="2"
        >
          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({ id: 'form__swap_to_another_address' })}
          </Typography.Body2>
          <Box>
            <Switch
              labelType="false"
              size="mini"
              onToggle={onToggle}
              isChecked={allowAnotherRecipientAddress}
            />
          </Box>
        </Box>
      );
    }
  }
  return null;
};

const TokenInput: FC<TokenInputProps> = ({
  inputValue,
  onPress,
  onChange,
  containerProps,
  extraData,
  isDisabled,
}) => {
  const intl = useIntl();
  const token = useAppSelector((s) => s.swap.outputToken);
  const price = useTokenPrice(token);
  const loading = useAppSelector((s) => s.swap.loading);
  const independentField = useAppSelector((s) => s.swap.independentField);
  const extraDataContent = useMemo(() => {
    if (!extraData?.socketBridgeExtraData?.arbRebateData) return null;
    const { arbRebateData } = extraData.socketBridgeExtraData;
    const {
      amountInUsd,
      amount,
      asset: { decimals, logoURI },
    } = arbRebateData;
    const amountParsed = new BigNumber(amount)
      .shiftedBy(-decimals)
      .decimalPlaces(4, BigNumber.ROUND_DOWN)
      .toFixed();
    return (
      <>
        <Typography.Body2
          textAlign="center"
          bold
        >{`+${amountParsed}`}</Typography.Body2>
        <Box
          justifyContent="center"
          alignItems="center"
          size={4}
          mx="2px"
          borderRadius="full"
          backgroundColor="black"
        >
          <Image source={{ uri: logoURI }} size={3} />
        </Box>
        <Typography.Body2 textAlign="center">{`($${amountInUsd.toFixed(
          2,
        )})${intl.formatMessage({
          id: 'title__reward',
        })}`}</Typography.Body2>
      </>
    );
  }, [extraData?.socketBridgeExtraData, intl]);
  return (
    <Box {...containerProps} position="relative">
      <Box position="relative">
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="flex-start"
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
                <Box w="full" position="relative">
                  <Box position="absolute" bottom="26px" right={2}>
                    <Box pointerEvents="none">
                      <Typography.Body2 color="text-subdued" numberOfLines={2}>
                        {extraDataContent}
                        <FormatCurrency
                          numbers={[price ?? 0, inputValue ?? 0]}
                          render={(ele) => (
                            <Typography.Body2 ml={3} color="text-subdued">
                              {price ? ele : '-'}
                            </Typography.Body2>
                          )}
                        />
                      </Typography.Body2>
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
                    // color="text-subdued"
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
                    isReadOnly
                    rightCustomElement={null}
                    focusOutlineColor="transparent"
                  />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
        <SendToAnotherAddress />
        <TokenInputReceivingAddressFieldShowControl />
      </Box>
    </Box>
  );
};

export default TokenInput;
