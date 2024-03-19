import { useMemo } from 'react';

import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export type INumberSizeableTextProps = Omit<ISizableTextProps, 'children'> &
  Omit<INumberFormatProps, 'value'> & {
    subTextStyle?: Omit<ISizableTextProps, 'children'>;
    children: string | number | undefined;
  };

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
  const result = useMemo(
    () =>
      ['string', 'number'].includes(typeof children)
        ? numberFormat({ formatter, formatterOptions, value: children }, true)
        : '',
    [formatter, formatterOptions, children],
  );

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
