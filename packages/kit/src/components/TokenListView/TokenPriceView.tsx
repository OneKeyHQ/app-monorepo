import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';
import { getFormattedNumber } from '../../utils/format';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceView(props: IProps) {
  const { $key, ...rest } = props;
  const [settings] = useSettingsPersistAtom();
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key];

  const price = getFormattedNumber(token?.price, { decimal: 4 });

  const content = useMemo(
    () => (
      <SizableText {...rest}>{`${settings.currencyInfo.symbol}${
        price ?? 0
      }`}</SizableText>
    ),
    [price, rest, settings.currencyInfo.symbol],
  );
  return content;
}

export { TokenPriceView };
