import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { NumberSizeableText, Stack, useMedia } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { RichBlock } from '../RichBlock/RichBlock';

function DeFiListBlock() {
  const intl = useIntl();
  const media = useMedia();
  const [settings] = useSettingsPersistAtom();
  const renderSubTitle = useCallback(() => {
    if (media.gtMd) {
      return (
        <NumberSizeableText
          size="$headingXl"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          123
        </NumberSizeableText>
      );
    }

    return null;
  }, [media.gtMd, settings.currencyInfo.symbol]);
  const renderContent = useCallback(() => {
    return 'defi list';
  }, []);
  return (
    <RichBlock
      withTitleSeparator
      title={intl.formatMessage({ id: ETranslations.global_earn })}
      subTitle={renderSubTitle()}
      content={renderContent()}
    />
  );
}

export { DeFiListBlock };
