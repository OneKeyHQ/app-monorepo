import { memo } from 'react';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';
import { displayFiatValueOrUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';

import {
  useFlattenAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import { useTokenFiat } from '../../states/jotai/contexts/tokenList/slc';
import { Currency } from '../Currency';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  const { tokenListMap: contextTokenListMap, useCellSeam } =
    useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  // Home path (spec §5): per-key cell subscription; other paths keep the
  // `contextTokenListMap ?? globalMap` fallback.
  const cellToken = useTokenFiat($key);
  const mapToken =
    (contextTokenListMap ?? globalTokenListMap)[$key] ??
    aggregateTokensMap[$key];
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
