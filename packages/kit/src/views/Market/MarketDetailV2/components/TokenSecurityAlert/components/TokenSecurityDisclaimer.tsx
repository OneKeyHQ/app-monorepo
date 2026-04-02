import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';

function TokenSecurityDisclaimer() {
  const intl = useIntl();

  return (
    <SizableText size="$bodyMd" color="$textSubdued">
      {intl.formatMessage({
        id: ETranslations.dexmarket_security_result_desc,
      })}
    </SizableText>
  );
}

const TokenSecurityDisclaimerMemo = memo(TokenSecurityDisclaimer);

export { TokenSecurityDisclaimerMemo as TokenSecurityDisclaimer };
