import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import type { ISizableTextProps } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useTokenListMapAtom } from '../../states/jotai/contexts/tokenList';
import NumberSizeableTextWrapper from '../NumberSizeableTextWrapper';

type IProps = {
  $key: string;
  hideValue?: boolean;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  const [settings] = useSettingsPersistAtom();
  const [tokenListMap] = useTokenListMapAtom();

  const token = tokenListMap[$key];

  const fiatValue = useMemo(
    () => new BigNumber(token?.fiatValue ?? 0),
    [token?.fiatValue],
  );

  const content = useMemo(
    () => (
      <NumberSizeableTextWrapper
        formatter="value"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
        {...rest}
      >
        {fiatValue.isNaN() ? 0 : fiatValue.toFixed()}
      </NumberSizeableTextWrapper>
    ),
    [fiatValue, rest, settings.currencyInfo.symbol],
  );

  if (!token) {
    return null;
  }

  return content;
}

export { TokenValueView };
