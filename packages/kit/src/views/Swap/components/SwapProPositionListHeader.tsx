import { useIntl } from 'react-intl';

import { DashText, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { SwapTestIDs } from '../testIDs';

function SwapProPositionListHeader({
  stockLayout = false,
}: {
  stockLayout?: boolean;
}) {
  const intl = useIntl();

  return (
    <XStack
      testID={SwapTestIDs.proPositionListHeader}
      alignItems="center"
      gap="$3"
      py={stockLayout ? '$0' : '$1'}
      h={stockLayout ? 16 : undefined}
    >
      <Stack flexGrow={1} flexBasis={0} alignItems="flex-start">
        <SizableText
          size={stockLayout ? '$bodySm' : '$headingXs'}
          color="$textSubdued"
          textTransform={stockLayout ? 'none' : 'uppercase'}
        >
          {intl.formatMessage({ id: ETranslations.dexmarket_token_name })}
        </SizableText>
      </Stack>
      <XStack
        flexGrow={1}
        flexBasis={0}
        justifyContent="flex-end"
        gap="$1"
        alignItems="center"
      >
        {stockLayout ? (
          <SizableText size="$bodySm" color="$textSubdued">
            {`${intl.formatMessage({ id: ETranslations.dexmarket_details_history_value })} / ${intl.formatMessage({ id: ETranslations.perp_position_pnl_mobile })}`}
          </SizableText>
        ) : (
          <>
            <SizableText
              size="$headingXs"
              color="$textSubdued"
              textTransform="uppercase"
            >
              {`${intl.formatMessage({
                id: ETranslations.dexmarket_details_history_value,
              })} / `}
            </SizableText>
            <DashText
              size="$headingXs"
              color="$textSubdued"
              textTransform="uppercase"
              dashThickness={0.5}
              tooltip={intl.formatMessage({
                id: ETranslations.marketdex_un_pnl,
              })}
              tooltipTitle={intl.formatMessage({
                id: ETranslations.marketdex_unrealized_pnl,
              })}
            >
              {intl.formatMessage({
                id: ETranslations.perp_position_pnl_mobile,
              })}
            </DashText>
          </>
        )}
      </XStack>
    </XStack>
  );
}

export default SwapProPositionListHeader;
