import { memo } from 'react';

import BigNumber from 'bignumber.js';

import { type ISizableTextProps, SizableText } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  UNAVAILABLE_DISPLAY,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';

import {
  useFlattenAggregateTokensMapAtom,
  useTokenListMapAtom,
} from '../../states/jotai/contexts/tokenList';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

import { useTokenListViewContext } from './TokenListViewContext';

type IProps = {
  $key: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  const [settings] = useSettingsPersistAtom();
  const { tokenListMap: contextTokenListMap } = useTokenListViewContext();
  const [globalTokenListMap] = useTokenListMapAtom();
  const [aggregateTokensMap] = useFlattenAggregateTokensMapAtom();
  const tokenListMap = contextTokenListMap ?? globalTokenListMap;
  const token = tokenListMap[$key] ?? aggregateTokensMap[$key];

  if (!token) {
    return <SizableText {...rest}>-</SizableText>;
  }

  if (!isValidNumberValue(token.fiatValue)) {
    return (
      <NumberSizeableTextWrapper
        formatter="value"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
        {...rest}
      >
        {UNAVAILABLE_DISPLAY}
      </NumberSizeableTextWrapper>
    );
  }

  const fiatValue = new BigNumber(token.fiatValue);

  return (
    <NumberSizeableTextWrapper
      formatter="value"
      formatterOptions={{ currency: settings.currencyInfo.symbol }}
      {...rest}
    >
      {fiatValue.toFixed()}
    </NumberSizeableTextWrapper>
  );
}

export default memo(TokenValueView);
