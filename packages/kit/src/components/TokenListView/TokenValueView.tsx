import { memo } from 'react';

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

  const fiatValue = new BigNumber(token?.fiatValue ?? 0);

  if (!token) {
    return null;
  }

  return (
    <NumberSizeableTextWrapper
      formatter="value"
      formatterOptions={{ currency: settings.currencyInfo.symbol }}
      {...rest}
    >
      {fiatValue.isNaN() ? 0 : fiatValue.toFixed()}
    </NumberSizeableTextWrapper>
  );
}

export default memo(TokenValueView);
