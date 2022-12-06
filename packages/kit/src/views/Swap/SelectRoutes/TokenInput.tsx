import { FC } from 'react';

import {
  Box,
  Center,
  Image,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/engine/src/types/token';

import { useNetwork } from '../../../hooks';
import { formatAmount, getTokenAmountValue } from '../utils';

type TokenInputProps = {
  token?: Token;
  amount?: string;
  rightAlign?: boolean;
};

export const TokenInput: FC<TokenInputProps> = ({
  token,
  amount,
  rightAlign,
}) => {
  const isSmall = useIsVerticalLayout();
  const { network } = useNetwork({ networkId: token?.networkId });

  let text = '';
  if (token && amount) {
    text = formatAmount(getTokenAmountValue(token, amount), 4);
  }
  if (!token) return null;
  return (
    <Box flexDirection={rightAlign ? 'row-reverse' : 'row'} alignItems="center">
      <Box position="relative">
        <Image w="6" h="6" src={token?.logoURI} borderRadius="full" />
        {network ? (
          <Box position="absolute" top={-4} right={-4}>
            <Center w="4" h="4" borderRadius="full" bg="background-default">
              <Image src={network.logoURI} w="3" h="3" />
            </Center>
          </Box>
        ) : null}
      </Box>
      <Box w="2" />
      {isSmall ? (
        <Typography.Body2 color="text-default">{text}</Typography.Body2>
      ) : (
        <Box>
          <Typography.Body2Strong>
            {text}
            {token.symbol.toUpperCase()}
          </Typography.Body2Strong>
          <Typography.Caption
            color="text-subdued"
            textAlign={rightAlign ? 'right' : 'left'}
          >
            {network?.name}
          </Typography.Caption>
        </Box>
      )}
    </Box>
  );
};
