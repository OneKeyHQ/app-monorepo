import React, { ComponentProps, FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  NumberInput,
  Pressable,
  Token,
  Typography,
} from '@onekeyhq/components';

import { useManageTokens } from '../../../../hooks/useManageTokens';
import { Token as TokenType } from '../../../../store/typings';

type TokenInputProps = {
  token?: TokenType;
  label?: string;
  inputValue?: string;
  onPress?: () => void;
  onChange?: (text: string) => void;
  containerProps?: ComponentProps<typeof Box>;
};

const TokenInput: FC<TokenInputProps> = ({
  label,
  inputValue,
  onPress,
  token,
  onChange,
  containerProps,
}) => {
  const intl = useIntl();
  const { balances } = useManageTokens();
  const value = token ? balances[token?.tokenIdOnNetwork || 'main'] : 0;
  return (
    <Box px="3" {...containerProps}>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        mb="2"
      >
        <Typography.Body2 color="text-subdued">{label}</Typography.Body2>
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage(
            { id: 'content__balance_str' },
            { '0': Number(value) === 0 ? '0' : Number(value).toFixed(6) },
          )}
        </Typography.Body2>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box flex="1">
          <NumberInput
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
            pl="0"
            h="auto"
          />
        </Box>
        <HStack alignItems="center">
          {token ? (
            <Pressable
              onPress={onPress}
              flexDirection="row"
              alignItems="center"
              _hover={{ bg: 'surface-hovered' }}
              borderRadius={12}
              h="8"
              p="1"
            >
              <HStack alignItems="center" space={2}>
                <Token size="6" src={token.logoURI} />
                <Typography.Body1>{token.symbol}</Typography.Body1>
              </HStack>
              <Center w="5" h="5">
                <Icon size={20} name="ChevronDownSolid" />
              </Center>
            </Pressable>
          ) : (
            <Pressable
              flexDirection="row"
              alignItems="center"
              onPress={onPress}
            >
              <Typography.Body1>
                {intl.formatMessage({ id: 'title__select_a_token' })}
              </Typography.Body1>
              <Center w="5" h="5">
                <Icon size={20} name="ChevronDownSolid" />
              </Center>
            </Pressable>
          )}
        </HStack>
      </Box>
    </Box>
  );
};

export default TokenInput;
