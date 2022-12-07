import React, { ComponentProps, FC, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  NumberInput,
  Pressable,
  Typography,
  utils,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector, useNavigation } from '../../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../../routes/routesEnum';
import { setRecipient } from '../../../../store/reducers/swap';
import { Token as TokenType } from '../../../../store/typings';
import { useSwapQuoteCallback, useSwapRecipient } from '../../hooks/useSwap';
import { SwapRoutes } from '../../typings';
import { TokenImage } from '../TokenImage';

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
  const recipient = useSwapRecipient();
  const onSwapQuote = useSwapQuoteCallback({ showLoading: true });
  const onPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.PickRecipient,
        params: {
          networkId: outputTokenNetwork?.id,
          onSelected: ({ address: selectedAddress, name: selectedName }) => {
            backgroundApiProxy.dispatch(
              setRecipient({
                address: selectedAddress,
                name: selectedName,
                networkId: outputTokenNetwork?.id,
                networkImpl: outputTokenNetwork?.impl,
              }),
            );
            onSwapQuote();
          },
        },
      },
    });
  }, [
    navigation,
    outputTokenNetwork?.id,
    outputTokenNetwork?.impl,
    onSwapQuote,
  ]);

  let text = '';
  const { address, name } = recipient ?? {};
  if (address && name) {
    text = `${name}(${address.slice(-4)})`;
  } else if (address) {
    text = `${utils.shortenAddress(address)}`;
  }

  if (address) {
    return (
      <Pressable flexDirection="row" alignItems="center" onPress={onPress}>
        <Box
          py="1"
          px="2"
          flexDirection="row"
          bg="surface-neutral-subdued"
          borderRadius="12"
        >
          <Typography.Caption color="text-default" mr="1" numberOfLines={1}>
            {text}
          </Typography.Caption>
        </Box>
      </Pressable>
    );
  }
  return (
    <Pressable flexDirection="row" alignItems="center" onPress={onPress}>
      <Box
        flexDirection="row"
        py="1"
        px="2"
        bg="surface-neutral-subdued"
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
  label,
  inputValue,
  onPress,
  token,
  tokenNetwork,
  onChange,
  containerProps,
  isDisabled,
}) => {
  const intl = useIntl();
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
          <TokenInputReceivingAddress />
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
                pt="1.5"
                pb="4"
                pr="2"
                textAlign="right"
                isDisabled={isDisabled}
                rightCustomElement={null}
                focusOutlineColor="transparent"
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default TokenInput;
