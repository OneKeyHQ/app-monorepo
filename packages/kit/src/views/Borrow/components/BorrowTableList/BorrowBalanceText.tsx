import BigNumber from 'bignumber.js';

import { NumberSizeableText } from '@onekeyhq/components';
import type { ISizableTextProps } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import type { IEarnText } from '@onekeyhq/shared/types/staking';

type IBorrowBalanceTextProps = Omit<ISizableTextProps, 'children'> & {
  text?: IEarnText;
  value?: string;
  kind: 'balance' | 'fiat';
};

export function BorrowBalanceText({
  text,
  value,
  kind,
  ...props
}: IBorrowBalanceTextProps) {
  if (!text?.text) {
    return <EarnText text={text} {...props} />;
  }
  if (/^(?:-+|\*+)$/.test(text.text.trim())) {
    return <EarnText text={text} {...props} />;
  }
  if (kind === 'balance') {
    const amount = new BigNumber(value ?? '');
    if (amount.isFinite() && !amount.isNegative()) {
      return (
        <NumberSizeableText
          {...props}
          size={text.size ?? props.size}
          color={(text.color as ISizableTextProps['color']) ?? props.color}
          autoFormatter="balance-marketCap"
          autoFormatterThreshold={1000}
          accessibilityLabel={props.accessibilityLabel ?? amount.toFixed()}
          aria-label={
            props['aria-label'] ?? props.accessibilityLabel ?? amount.toFixed()
          }
        >
          {value}
        </NumberSizeableText>
      );
    }
  } else {
    // Borrow's asset-list provides only the displayed fiat value, formatted
    // with a currency prefix and English separators, not a raw fiat amount.
    const match = text.text.match(
      /^([^\d<>-]*)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/,
    );
    if (match) {
      const amount = `${match[2].replaceAll(',', '')}${match[3] ?? ''}`;
      if (new BigNumber(amount).gte(1000)) {
        return (
          <NumberSizeableText
            {...props}
            size={text.size ?? props.size}
            color={(text.color as ISizableTextProps['color']) ?? props.color}
            autoFormatter="value-marketCap"
            autoFormatterThreshold={1000}
            formatterOptions={{ currency: match[1] }}
            accessibilityLabel={props.accessibilityLabel ?? text.text}
            aria-label={
              props['aria-label'] ?? props.accessibilityLabel ?? text.text
            }
          >
            {amount}
          </NumberSizeableText>
        );
      }
    }
  }
  return <EarnText text={text} {...props} />;
}
