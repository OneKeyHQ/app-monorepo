import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IMarketListColumnHeaderProps = {
  changeSortType?: 'asc' | 'desc';
  changeSortTestID?: string;
  onChangeSortPress?: () => void;
};

function MarketListColumnHeaderBase({
  changeSortType,
  changeSortTestID,
  onChangeSortPress,
}: IMarketListColumnHeaderProps) {
  const intl = useIntl();
  let sortIconName:
    | 'ChevronDownSmallOutline'
    | 'ChevronTopSmallOutline'
    | 'ChevronGrabberVerOutline' = 'ChevronGrabberVerOutline';
  if (changeSortType === 'desc') {
    sortIconName = 'ChevronDownSmallOutline';
  } else if (changeSortType === 'asc') {
    sortIconName = 'ChevronTopSmallOutline';
  }

  return (
    <XStack px="$5">
      <XStack jc="flex-start" ai="center" width="50%">
        <SizableText color="$textSubdued" size="$bodySmMedium" py="$2">
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
          <XStack
            alignItems="center"
            justifyContent="flex-end"
            width="$20"
            onPress={onChangeSortPress}
            pressStyle={onChangeSortPress ? { opacity: 0.8 } : undefined}
            cursor={onChangeSortPress ? 'pointer' : undefined}
            testID={changeSortTestID}
          >
            <SizableText
              color="$textSubdued"
              size="$bodySmMedium"
              textAlign="right"
              numberOfLines={1}
              flexShrink={1}
            >
              {intl.formatMessage({
                id: ETranslations.dexmarket_token_change,
              })}
            </SizableText>
            {onChangeSortPress ? (
              <Icon name={sortIconName} color="$iconSubdued" size="$4" />
            ) : null}
          </XStack>
        </XStack>
      </XStack>
    </XStack>
  );
}

export const MarketListColumnHeader = memo(MarketListColumnHeaderBase);
