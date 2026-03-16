import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function MarketListColumnHeaderBase() {
  const intl = useIntl();

  return (
    <XStack mx="$2">
      <XStack jc="flex-start" ai="center" width="50%">
        <SizableText
          color="$textSubdued"
          size="$bodySmMedium"
          py="$2"
          paddingLeft="$5"
        >
          {`${intl.formatMessage({
            id: ETranslations.global_name,
          })} / ${intl.formatMessage({
            id: ETranslations.dexmarket_turnover,
          })}`}
        </SizableText>
      </XStack>
      <XStack jc="flex-end" ai="center" width="50%">
        <XStack
          justifyContent="flex-end"
          alignItems="center"
          gap="$2"
          pr="$5"
          py="$2"
          width="100%"
        >
          <SizableText
            color="$textSubdued"
            size="$bodySmMedium"
            flexShrink={1}
            textAlign="right"
          >
            {intl.formatMessage({ id: ETranslations.global_price })}
          </SizableText>
          <SizableText
            color="$textSubdued"
            size="$bodySmMedium"
            width="$20"
            textAlign="center"
          >
            {intl.formatMessage({
              id: ETranslations.dexmarket_token_change,
            })}
          </SizableText>
        </XStack>
      </XStack>
    </XStack>
  );
}

export const MarketListColumnHeader = memo(MarketListColumnHeaderBase);
