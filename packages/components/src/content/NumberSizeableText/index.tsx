import { useMemo } from 'react';

import { getFontSize } from '@onekeyhq/components';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export type INumberSizeableTextProps = Omit<ISizableTextProps, 'children'> &
  INumberFormatProps & {
    subTextStyle?: Omit<ISizableTextProps, 'children'>;
    children: string | number | undefined;
  };

export function NumberSizeableText({
  children,
  formatter,
  formatterOptions,
  subTextStyle,
  ...props
}: INumberSizeableTextProps) {
  const result = useMemo(() => {
    try {
      return ['string', 'number'].includes(typeof children)
        ? numberFormat(String(children), { formatter, formatterOptions }, true)
        : '';
    } catch (e) {
      return children?.toString() || '';
    }
  }, [formatter, formatterOptions, children]);

  const scriptFontSize = Math.ceil(
    props.fontSize || getFontSize(props.size) * 0.6,
  );
  return typeof result === 'string' ? (
    <SizableText {...props}>{result}</SizableText>
  ) : (
    <SizableText {...props}>
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
