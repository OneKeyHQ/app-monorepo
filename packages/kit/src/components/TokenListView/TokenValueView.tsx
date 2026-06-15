import { memo } from 'react';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';
import { displayFiatValueOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import { useTokenFiat } from '../../states/jotai/contexts/tokenList/slc';
import { Currency } from '../Currency';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
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

  if (!token) {
    return <SizableText {...rest}>-</SizableText>;
  }

  return (
    <Currency
      formatter="value"
      sourceCurrency={token.currency}
      {...(rest as React.ComponentProps<typeof Currency>)}
    >
      {displayFiatValueOrUnavailable(token.fiatValue, token.balanceParsed)}
    </Currency>
  );
}

export default memo(TokenValueView);
