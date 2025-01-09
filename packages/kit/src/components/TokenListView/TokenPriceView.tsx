import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useTokenListMapAtom } from '../../states/jotai/contexts/tokenList';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenPriceView(props: IProps) {
  const { $key, ...rest } = props;
  const [settings] = useSettingsPersistAtom();
  const [tokenListMap] = useTokenListMapAtom();
  const token = tokenListMap[$key];

  const content = useMemo(
    () => (
      <NumberSizeableText
        formatter="price"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
        {...rest}
      >
        {token?.price ?? 0}
      </NumberSizeableText>
    ),
    [rest, settings.currencyInfo.symbol, token?.price],
  );
  return content;
}

export { TokenPriceView };
