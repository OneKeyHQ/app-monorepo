import { useCallback, useMemo } from 'react';

import {
  IconButton,
  Image,
  ListItem,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { shortContractAddress } from '../utils/utils';

import type { ISwapNetwork, ISwapToken } from '../types';

interface ISwapTokenSelectCellProps {
  token: ISwapToken;
  isSearch?: boolean;
  selectNetwork?: ISwapNetwork;
  tokenNetwork?: ISwapNetwork;
  onSelectToken: (token: ISwapToken) => void;
}
const SwapTokenSelectCell = ({
  token,
  isSearch,
  onSelectToken,
  selectNetwork,
  tokenNetwork,
}: ISwapTokenSelectCellProps) => {
  const subTitle = useMemo(() => {
    if (isSearch) {
      return shortContractAddress(token.contractAddress);
    }
    if (selectNetwork?.networkId === 'all') {
      return tokenNetwork?.name ?? '';
    }
    return token.name;
  }, [isSearch, selectNetwork, token, tokenNetwork]);
  const onMore = useCallback(() => {}, []);
  return (
    <ListItem
      flex={1}
      key={`${token.symbol} - ${token.networkId}`}
      justifyContent="space-between"
      onPress={() => {
        onSelectToken(token);
      }}
    >
      <XStack flex={1}>
        <Image
          w="$10"
          h="$10"
          borderRadius="$5"
          source={{ uri: token.logoURI }}
        />
        <YStack>
          <SizableText>{token.symbol}</SizableText>
          <SizableText>{subTitle}</SizableText>
        </YStack>
      </XStack>
      <XStack flex={1} justifyContent="flex-end">
        <YStack>
          {token.balanceParsed ? (
            <SizableText>{token.balanceParsed ?? ''}</SizableText>
          ) : null}
          {token.fiatValue ? (
            <SizableText>{`$${token.fiatValue ?? ''}`}</SizableText>
          ) : null}
        </YStack>
        <IconButton
          ml="$4"
          w="$10"
          h="$12"
          icon="DotVerOutline"
          onPress={onMore}
        />
      </XStack>
    </ListItem>
  );
};

export default SwapTokenSelectCell;
