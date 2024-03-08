import { useMemo } from 'react';

import type { IFormatterOptions } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatBalance,
  formatDisplayNumber,
  formatMarketCap,
  formatPrice,
  formatPriceChange,
  formatValue,
} from '@onekeyhq/shared/src/utils/numberUtils';

import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export const NUMBER_FORMATTER = {
  /** Balance/Amount */
  balance: formatBalance,
  /** Price/USD */
  price: formatPrice,
  /** PriceChange */
  priceChange: formatPriceChange,
  /** DeFi */
  value: formatValue,
  /** FDV / MarketCap / Volume / Liquidty / TVL / TokenSupply */
  marketCap: formatMarketCap,
};

export interface INumberSizeableTextProps extends ISizableTextProps {
  formatter: keyof typeof NUMBER_FORMATTER;
  subTextStyle?: Omit<ISizableTextProps, 'children'>;
  formatterOptions?: IFormatterOptions;
}

const subTextStyles = {
  sup: undefined,
  sub: {
    fontSize: 8,
    fontWeight: '900',
  } as ISizableTextProps,
};

export function NumberSizeableText({
  children,
  formatter,
  formatterOptions,
  subTextStyle,
  ...props
}: INumberSizeableTextProps) {
  console.log('----children', children);
  const result = useMemo(
    () =>
      ['string', 'number'].includes(typeof children)
        ? formatDisplayNumber(
            NUMBER_FORMATTER[formatter](String(children), formatterOptions),
          )
        : '',
    [formatter, formatterOptions, children],
  );
  console.log('----reuslt', result);
  return typeof result === 'string' ? (
    <SizableText {...props}>{result}</SizableText>
  ) : (
    <SizableText>
      {result.map((r) =>
        typeof r === 'string' ? (
          <SizableText {...props}>{r}</SizableText>
        ) : (
          <SizableText
            {...props}
            {...subTextStyles[r.type as keyof typeof subTextStyles]}
            {...subTextStyle}
          >
            {r.value}
          </SizableText>
        ),
      )}
    </SizableText>
  );
}
