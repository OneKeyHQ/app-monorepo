import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useTokenListMapAtom } from '../../states/jotai/contexts/tokenList';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  const [settings] = useSettingsPersistAtom();
  const [tokenListMap] = useTokenListMapAtom();

  const token = tokenListMap[$key];

  const content = useMemo(
    () => (
      <NumberSizeableText
        formatter="value"
        formatterOptions={{ currency: settings.currencyInfo.symbol }}
        {...rest}
      >
        {token?.fiatValue ?? 0}
      </NumberSizeableText>
    ),
    [rest, settings.currencyInfo.symbol, token?.fiatValue],
  );
  return content;
}

export { TokenValueView };
