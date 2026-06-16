import { memo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { displayOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { useTokenFiat } from '../../states/jotai/contexts/tokenList/cells';
import { Currency } from '../Currency';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceView(props: IProps) {
  const { $key, ...rest } = props;
  const {
    tokenListMap: contextTokenListMap,
    aggregateTokenFiatMap: contextAggregateTokenFiatMap,
    useCellSeam,
  } = useTokenListViewContext();
  // Home path (spec §5): per-key cell subscription; non-cell paths resolve from
  // the context map + context aggregate fiat (PR-6).
  const cellToken = useTokenFiat($key);
  const mapToken =
    contextTokenListMap?.[$key] ?? contextAggregateTokenFiatMap?.[$key];
  const token = useCellSeam ? cellToken : mapToken;

  return (
    <Currency
      formatter="price"
      sourceCurrency={token?.currency}
      {...(rest as React.ComponentProps<typeof Currency>)}
    >
      {displayOrUnavailable(token?.price)}
    </Currency>
  );
}

export default memo(TokenPriceView);
