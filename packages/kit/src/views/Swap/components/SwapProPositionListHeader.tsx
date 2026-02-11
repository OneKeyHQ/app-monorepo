import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
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
      <Stack flexGrow={1} flexBasis={0} alignItems="flex-end">
        <SizableText
          size="$headingXs"
          color="$textSubdued"
          textTransform="uppercase"
        >
          {`${intl.formatMessage({
            id: ETranslations.dexmarket_details_history_amount,
          })} / ${intl.formatMessage({
            id: ETranslations.dexmarket_details_history_value,
          })}`}
        </SizableText>
      </Stack>
    </XStack>
  );
}

export default SwapProPositionListHeader;
