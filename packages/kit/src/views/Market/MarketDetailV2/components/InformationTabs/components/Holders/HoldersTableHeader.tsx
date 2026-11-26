import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useHoldersWidth } from './HoldersLayoutContext';
import { holderLayout } from './holderTable';

export function HoldersTableHeader() {
  const intl = useIntl();
  const { width } = useHoldersWidth();
  const layout = holderLayout(width);
  const label = {
    size: layout.wide ? '$bodySmMedium' : '$bodySm',
    color: '$textSubdued',
    numberOfLines: 1,
  } as const;
  return (
    <XStack
      width={width > 0 ? width : undefined}
      alignItems="center"
      pl={20}
      pr={layout.padding}
      gap={layout.gap}
    >
      {layout.wide ? (
        <SizableText {...label} width={layout.rankWidth}>
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_holders_rank,
          })}
        </SizableText>
      ) : null}
      <SizableText
        {...label}
        width={layout.addressWidth}
        flex={layout.wide ? undefined : 1}
      >
        {intl.formatMessage({ id: ETranslations.global_address })}
      </SizableText>
      <SizableText {...label} width={layout.percentageWidth} textAlign="right">
        %
      </SizableText>
      {layout.wide ? (
        <SizableText {...label} width={layout.amountWidth} textAlign="right">
          {intl.formatMessage({
            id: ETranslations.dexmarket_details_history_amount,
          })}
        </SizableText>
      ) : null}
      <SizableText {...label} width={layout.valueWidth} textAlign="right">
        {intl.formatMessage({
          id: ETranslations.dexmarket_details_history_value,
        })}
      </SizableText>
    </XStack>
  );
}
