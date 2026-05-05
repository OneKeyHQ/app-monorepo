import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { isString } from 'lodash';

import type { FontSizeTokens } from '@onekeyhq/components/src/shared/tamagui';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';

import { SizableText } from '../../primitives/SizeableText';
import { getFontSize, getFontToken } from '../../utils/getFontSize';

import type { ISizableTextProps } from '../../primitives';

export type INumberSizeableTextProps = Omit<ISizableTextProps, 'children'> &
  INumberFormatProps & {
    /** Style overrides for leading-zero subscript text (e.g. 0.0₅41). */
    subTextStyle?: Omit<ISizableTextProps, 'children'>;
    /** Style overrides applied to the entire content wrapper. */
    contentStyle?: Omit<ISizableTextProps, 'children'>;
    /** Style overrides for the decimal portion when splitDecimal is enabled. @default { color: '$textDisabled' } */
    decimalTextStyle?: Omit<ISizableTextProps, 'children'>;
    children: string | number | undefined;
    autoFormatter?: 'price-marketCap' | 'balance-marketCap' | 'value-marketCap';
    /** Threshold for autoFormatter to switch between normal and marketCap format. @default 1_000_000 */
    autoFormatterThreshold?: number;
  };

const DEFAULT_DECIMAL_TEXT_STYLE: Omit<ISizableTextProps, 'children'> = {
  color: '$textDisabled',
};

export function NumberSizeableText({
  children,
  formatter,
  formatterOptions,
  splitDecimal,
  subTextStyle,
  contentStyle,
  decimalTextStyle,
  hideValue,
  autoFormatter,
  autoFormatterThreshold = 1_000_000,
  flexShrink,
  flexGrow,
  flex,
  minWidth,
  maxWidth,
  width,
  ...props
}: INumberSizeableTextProps) {
  const layoutProps = {
    flexShrink,
    flexGrow,
    flex,
    minWidth,
    maxWidth,
    width,
  };
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

  const mergedDecimalTextStyle = useMemo(
    () =>
      splitDecimal
        ? { ...DEFAULT_DECIMAL_TEXT_STYLE, ...decimalTextStyle }
        : undefined,
    [splitDecimal, decimalTextStyle],
  );

  const result = useMemo(() => {
    if (isString(children) && ['--', ' -- ', ' - ', '-'].includes(children)) {
      return children;
    }
    return ['string', 'number'].includes(typeof children)
      ? numberFormatAsRenderText(String(children), {
          formatter: actualFormatter,
          formatterOptions,
          splitDecimal,
        })
      : '';
  }, [actualFormatter, formatterOptions, children, splitDecimal]);

  const parentFont = useMemo(
    () => getFontToken(props.size as FontSizeTokens),
    [props.size],
  );

  const parentFontSize = useMemo(
    () =>
      (props.fontSize as number) || getFontSize(props.size as FontSizeTokens),
    [props.fontSize, props.size],
  );

  const parentFontWeight = (props.fontWeight ??
    (parentFont as { fontWeight?: number })
      ?.fontWeight) as ISizableTextProps['fontWeight'];

  const scriptFontSize = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      props.fontSize !== 'unset'
        ? Math.ceil(parentFontSize * 0.6)
        : props.fontSize,
    [props.fontSize, parentFontSize],
  );

  if (hideValue) {
    if (formatter === 'balance' && formatterOptions?.tokenSymbol) {
      return (
        <SizableText {...props} {...layoutProps}>
          **** {formatterOptions.tokenSymbol}
        </SizableText>
      );
    }
    return (
      <SizableText {...props} {...layoutProps}>
        ****
      </SizableText>
    );
  }

  return typeof result === 'string' ? (
    <SizableText {...props} {...layoutProps} {...contentStyle}>
      {result}
    </SizableText>
  ) : (
    <SizableText {...props} {...layoutProps} {...contentStyle}>
      {/* eslint-disable no-nested-ternary */}
      {result.map((r, index) =>
        typeof r === 'string' ? (
          <SizableText
            key={index}
            color={props.color}
            fontWeight={parentFontWeight}
            fontSize={parentFontSize}
            lineHeight={props.lineHeight ?? parentFontSize}
          >
            {r}
          </SizableText>
        ) : 'type' in r && r.type === 'decimal' ? (
          <SizableText key={index} {...props} {...mergedDecimalTextStyle}>
            {r.value}
          </SizableText>
        ) : (
          <SizableText
            key={index}
            color={props.color}
            fontWeight={parentFontWeight}
            fontSize={scriptFontSize}
            lineHeight={parentFontSize}
            {...subTextStyle}
          >
            {r.value}
          </SizableText>
        ),
      )}
      {/* eslint-enable no-nested-ternary */}
    </SizableText>
  );
}
