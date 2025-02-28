import { memo } from 'react';

import { useTokenDetailsContext } from './TokenDetailsContext';
import { Page, XStack, SizableText } from '@onekeyhq/components';
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function TokenDetailsFooter() {
  const intl = useIntl();
  const { tokenMetadata } = useTokenDetailsContext();
  const [settings] = useSettingsPersistAtom();

  if (tokenMetadata) {
    <Page.Footer>
      <XStack>
        <SizableText size="$bodyMd">
          {intl.formatMessage({ id: ETranslations.global_market })}
        </SizableText>
        <XStack>
          <SizableText size="$bodyMd">
            {intl.formatMessage({ id: ETranslations.global_market_cap })}
          </SizableText>
        </XStack>
      </XStack>
    </Page.Footer>;
  }

  return null;
}

export default memo(TokenDetailsFooter);
