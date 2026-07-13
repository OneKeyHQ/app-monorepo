import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapRateDifferenceUnit } from '@onekeyhq/shared/types/swap/types';

export type ISwapRateDifference = {
  value: string;
  unit: ESwapRateDifferenceUnit;
};

type ISwapRateDifferenceTextProps = {
  loading?: boolean;
  rateDifference?: ISwapRateDifference;
  size?: '$bodySm' | '$bodyMd';
};

function BasicSwapRateDifferenceText({
  loading,
  rateDifference,
  size = '$bodySm',
}: ISwapRateDifferenceTextProps) {
  const intl = useIntl();
  const onRateDifferencePress = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.swap_page_price_impact_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.swap_page_price_impact_content_1,
      }),
      renderContent: (
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.swap_page_price_impact_content_2,
          })}
        </SizableText>
      ),
      showCancelButton: false,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_ok,
      }),
    });
  }, [intl]);

  if (!rateDifference) {
    return null;
  }

  let color = '$textSubdued';
  if (loading) {
    color = '$textPlaceholder';
  }
  if (rateDifference.unit === ESwapRateDifferenceUnit.NEGATIVE) {
    color = '$textCritical';
  }
  if (rateDifference.unit === ESwapRateDifferenceUnit.POSITIVE) {
    color = '$textSuccess';
  }

  return (
    <XStack alignItems="center">
      <SizableText size={size} color={color}>
        (
      </SizableText>
      <SizableText
        size={size}
        color={color}
        cursor="pointer"
        onPress={onRateDifferencePress}
        {...(rateDifference.unit === ESwapRateDifferenceUnit.NEGATIVE && {
          textDecorationLine: 'underline',
          textDecorationStyle: 'dotted',
        })}
      >
        {rateDifference.value}
      </SizableText>
      <SizableText size={size} color={color}>
        )
      </SizableText>
    </XStack>
  );
}

export const SwapRateDifferenceText = memo(BasicSwapRateDifferenceText);
