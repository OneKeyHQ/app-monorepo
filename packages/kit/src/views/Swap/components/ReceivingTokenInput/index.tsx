import React, { ComponentProps, FC } from 'react';

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

import { Token as TokenType } from '../../../../store/typings';

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
          <Typography.Caption p="2" color="text-subdued" fontWeight={500}>
            {label}
          </Typography.Caption>
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
              <TokenImage
                size={8}
                token={token}
                showInfo
                name={token.symbol.toUpperCase()}
                description={tokenNetwork.shortName}
                showTokenVerifiedIcon={false}
              />
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
              pr="2"
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
