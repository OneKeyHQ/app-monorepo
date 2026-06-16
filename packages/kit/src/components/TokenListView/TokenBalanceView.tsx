import { memo } from 'react';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';
import { displayOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { useTokenFiat } from '../../states/jotai/contexts/tokenList/cells';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
  symbol: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenBalanceView(props: IProps) {
  const { $key, symbol, ...rest } = props;
  const {
    tokenListMap: contextTokenListMap,
    aggregateTokenFiatMap: contextAggregateTokenFiatMap,
    useCellSeam,
  } = useTokenListViewContext();
  // Home path (spec §5): per-key cell subscription. Called unconditionally to
  // satisfy the rules of hooks; the result is only used when the cell seam is
  // active. Non-cell paths (selector/AssetList/LP-scoped) resolve from the
  // context map, with aggregate fiat from the context aggregate map (PR-6).
  const cellToken = useTokenFiat($key || '');
  const mapToken =
    contextTokenListMap?.[$key || ''] ??
    contextAggregateTokenFiatMap?.[$key || ''];
  const token = useCellSeam ? cellToken : mapToken;

  if (!token) {
    return <SizableText {...rest}>-</SizableText>;
  }

  return (
    <NumberSizeableTextWrapper
      formatter="balance"
      formatterOptions={{ tokenSymbol: symbol }}
      {...rest}
    >
      {displayOrUnavailable(token?.balanceParsed)}
    </NumberSizeableTextWrapper>
  );
}

export default memo(TokenBalanceView);
