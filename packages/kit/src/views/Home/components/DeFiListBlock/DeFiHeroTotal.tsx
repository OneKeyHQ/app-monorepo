import { useIntl } from 'react-intl';

import { SizableText, Skeleton, XStack } from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IDeFiHeroTotalProps = {
  total: number | string;
  isLoading?: boolean;
};

function DeFiHeroTotal({ total, isLoading }: IDeFiHeroTotalProps) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const currencySymbol = settings.currencyInfo.symbol;

  return (
    <XStack alignItems="center" gap="$1" py="$2">
      <SizableText size="$headingXl" color="$text">
        {intl.formatMessage({ id: ETranslations.global_earn })}
      </SizableText>
      <SizableText size="$headingXl" color="$textSubdued">
        ·
      </SizableText>
      {isLoading ? (
        <Skeleton.HeadingLg />
      ) : (
        <NumberSizeableTextWrapper
          hideValue
          size="$headingXl"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{ currency: currencySymbol }}
        >
          {total ?? 0}
        </NumberSizeableTextWrapper>
      )}
    </XStack>
  );
}

export { DeFiHeroTotal };
