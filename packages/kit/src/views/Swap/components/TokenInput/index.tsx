import React, { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Icon,
  Input,
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
};

const TokenInput: FC<TokenInputProps> = ({
  label,
  inputValue,
  onPress,
  token,
  onChange,
}) => {
  const intl = useIntl();
  const { balances } = useManageTokens();
  const value = token ? balances[token?.tokenIdOnNetwork || 'main'] : 0;
  return (
    <Box h="20" px="3" py="4">
      <Box display="flex" flexDirection="row" justifyContent="space-between">
        <Typography.Caption>{label}</Typography.Caption>
        <Typography.Caption>
          {intl.formatMessage(
            { id: 'content__balance_str' },
            { '0': Number(value).toFixed(2) },
          )}
        </Typography.Caption>
      </Box>
      <Box
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box flex="1">
          <Input
            borderWidth={0}
            placeholder="0.00"
            pl="0"
            bg="transparent"
            _hover={{ bg: 'transparent' }}
            _focus={{ bg: 'transparent' }}
            value={inputValue}
            onChangeText={onChange}
          />
        </Box>
        <Pressable onPress={onPress}>
          <HStack alignItems="center">
            {token ? (
              <HStack
                alignItems="center"
                bg="surface-hovered"
                borderRadius={12}
                h="8"
                p="1"
              >
                <HStack alignItems="center" space={1}>
                  <Token size="6" src={token.logoURI} />
                  <Typography.Body1>{token.symbol}</Typography.Body1>
                </HStack>
                <Center w="5" h="5">
                  <Icon size={10} name="ChevronDownOutline" />
                </Center>
              </HStack>
            ) : (
              <HStack alignItems="center">
                <Typography.Body1>
                  {intl.formatMessage({ id: 'title__select_a_token' })}
                </Typography.Body1>
                <Center w="5" h="5">
                  <Icon size={10} name="ChevronDownOutline" />
                </Center>
              </HStack>
            )}
          </HStack>
        </Pressable>
      </Box>
    </Box>
  );
};

export default TokenInput;
