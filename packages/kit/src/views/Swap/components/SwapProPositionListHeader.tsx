import { useIntl } from 'react-intl';

import { DashText, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function SwapProPositionListHeader() {
  const intl = useIntl();

  return (
    <XStack
      testID="Swap-Pro-Position-List-Header"
      alignItems="center"
      gap="$3"
      py="$1"
    >
      <Stack flexGrow={1} flexBasis={0} alignItems="flex-start">
        <SizableText
          size="$headingXs"
          color="$textSubdued"
          textTransform="uppercase"
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
          dashColor="$textDisabled"
          dashThickness={0.5}
          tooltip={intl.formatMessage({ id: ETranslations.marketdex_un_pnl })}
          tooltipTitle={intl.formatMessage({
            id: ETranslations.marketdex_unrealized_pnl,
          })}
        >
          PnL
        </DashText>
      </XStack>
    </XStack>
  );
}

export default SwapProPositionListHeader;
