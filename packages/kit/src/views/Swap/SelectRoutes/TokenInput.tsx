import type { FC } from 'react';

import {
  Box,
  Center,
  Image,
  Token as TokenDisplay,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { Token } from '@onekeyhq/engine/src/types/token';

import { useNetwork } from '../../../hooks';

import { useTokenOutput } from './utils';

type TokenInputProps = {
  token?: Token;
  amount?: string;
  rightAlign?: boolean;
  isDisabled?: boolean;
};

export const TokenInput: FC<TokenInputProps> = ({
  token,
  amount,
  rightAlign,
  isDisabled,
}) => {
  const isSmall = useIsVerticalLayout();
  const { network } = useNetwork({ networkId: token?.networkId });
  const text = useTokenOutput({ token, amount });

  if (!token) return null;
  return (
    <Box
      flexDirection={rightAlign ? 'row-reverse' : 'row'}
      alignItems="center"
      maxW="full"
    >
      <Box position="relative">
        <TokenDisplay size={6} borderRadius="full" token={token} />
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
        <Box>
          <Typography.Body2
            numberOfLines={2}
            color={isDisabled ? 'text-disabled' : 'text-default'}
          >
            {text}
          </Typography.Body2>
        </Box>
      ) : (
        <Box flex="1">
          <Box flex="1" flexDirection="row">
            <Typography.Body2Strong
              isTruncated
              color={isDisabled ? 'text-disabled' : 'text-default'}
            >
              {text}
            </Typography.Body2Strong>
            <Typography.Body2Strong
              color={isDisabled ? 'text-disabled' : 'text-default'}
            >
              {token.symbol.toUpperCase()}
            </Typography.Body2Strong>
          </Box>
          <Typography.Caption
            isTruncated
            color={isDisabled ? 'text-disabled' : 'text-subdued'}
            textAlign={rightAlign ? 'right' : 'left'}
          >
            {network?.name}
          </Typography.Caption>
        </Box>
      )}
    </Box>
  );
};
