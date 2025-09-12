import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isString } from 'lodash';

import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { SizableText } from '../../primitives';
import { getFontSize } from '../../utils';

import type { ISizableTextProps } from '../../primitives';
import type { FontSizeTokens } from 'tamagui';

export type INumberSizeableTextProps = Omit<ISizableTextProps, 'children'> &
  INumberFormatProps & {
    subTextStyle?: Omit<ISizableTextProps, 'children'>;
    contentStyle?: Omit<ISizableTextProps, 'children'>;
    children: string | number | undefined;
    autoFormatter?: 'price-marketCap' | 'balance-marketCap' | 'value-marketCap';
    autoFormatterThreshold?: number;
  };

export function NumberSizeableText({
  children,
  formatter,
  formatterOptions,
  subTextStyle,
  contentStyle,
  hideValue,
  autoFormatter,
  autoFormatterThreshold = 1_000_000,
  ...props
}: INumberSizeableTextProps) {
  const actualFormatter = useMemo(() => {
    if (autoFormatter && ['string', 'number'].includes(typeof children)) {
      const numericValue = new BigNumber(String(children));
      const isAboveThreshold = numericValue.gte(autoFormatterThreshold);

      switch (autoFormatter) {
        case 'price-marketCap':
          return isAboveThreshold ? 'marketCap' : 'price';
        case 'balance-marketCap':
          return isAboveThreshold ? 'marketCap' : 'balance';
        case 'value-marketCap':
          return isAboveThreshold ? 'marketCap' : 'value';
        default:
          return formatter;
      }
    }
    return formatter;
  }, [autoFormatter, autoFormatterThreshold, children, formatter]);

  const result = useMemo(() => {
    if (isString(children) && ['--', ' -- ', ' - ', '-'].includes(children)) {
      return children;
    }
    return ['string', 'number'].includes(typeof children)
      ? numberFormat(
          String(children),
          { formatter: actualFormatter, formatterOptions },
          true,
        )
      : '';
  }, [actualFormatter, formatterOptions, children]);

  const scriptFontSize = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      props.fontSize !== 'unset'
        ? Math.ceil(
            (props.fontSize as number) ||
              getFontSize(props.size as FontSizeTokens) * 0.6,
          )
        : props.fontSize,
    [props.fontSize, props.size],
  );

  if (hideValue) {
    if (formatter === 'balance') {
      return (
        <SizableText {...props}>
          **** {formatterOptions?.tokenSymbol}
        </SizableText>
      );
    }
    return <SizableText {...props}>****</SizableText>;
  }

  return typeof result === 'string' ? (
    <SizableText {...props} {...contentStyle}>
      {result}
    </SizableText>
  ) : (
    <SizableText {...props} {...contentStyle}>
      {result.map((r, index) =>
        typeof r === 'string' ? (
          <SizableText key={index} {...props}>
            {r}
          </SizableText>
        ) : (
          <SizableText
            key={index}
            {...props}
            fontSize={scriptFontSize}
            {...subTextStyle}
          >
            {r.value}
          </SizableText>
        ),
      )}
    </SizableText>
  );
}
