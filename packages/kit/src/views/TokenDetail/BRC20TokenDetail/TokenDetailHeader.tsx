import type { ComponentProps } from 'react';
import { useContext } from 'react';

import { HStack, Token } from '@onekeyhq/components';

import { TokenDetailContext } from '../context';

import { TokenActions } from './TokenActions';

type Props = {
  onPressSend: () => void;
  onPressReceive: () => void;
  onPressTransfer: () => void;
  style?: ComponentProps<typeof HStack>;
  balanceWithoutRecycle: {
    balance: string;
    availableBalance: string;
    transferBalance: string;
  };
  isWatching: boolean;
};

function TokenDetailHeader(props: Props) {
  const context = useContext(TokenDetailContext);
  const { style, ...rest } = props;

  const tokenDetailInfo = context?.detailInfo;

  return (
    <HStack {...style} justifyContent="space-between">
      <Token
        size={8}
        showInfo
        token={{
          symbol: tokenDetailInfo?.symbol,
          logoURI: tokenDetailInfo?.logoURI,
        }}
      />
      <TokenActions {...rest} />
    </HStack>
  );
}

export { TokenDetailHeader };
