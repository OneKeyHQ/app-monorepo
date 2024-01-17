import { useMemo } from 'react';

import type { ISizableTextProps } from '@onekeyhq/components';
import { SizableText } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useTokenListMapAtom } from '../../states/jotai/contexts/token-list';
import { getFormattedNumber } from '../../utils/format';

type IProps = {
  $key: string;
} & ISizableTextProps;

function TokenValueView(props: IProps) {
  const { $key, ...rest } = props;
  const [settings] = useSettingsPersistAtom();
  const [tokenListMap] = useTokenListMapAtom();

  const token = tokenListMap[$key];
  const value = getFormattedNumber(token?.fiatValue, { decimal: 2 });

  const content = useMemo(
    () => (
      <SizableText {...rest}>{`${settings.currencyInfo.symbol}${
        value ?? 0
      }`}</SizableText>
    ),
    [rest, settings.currencyInfo.symbol, value],
  );
  return content;
}

export { TokenValueView };
