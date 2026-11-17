import { useCallback } from 'react';

import { HyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export const AAVE_E_MODE_HELP_URL = 'https://aave.com/help/borrowing/e-mode';

export function EModeDescription() {
  const handleAction = useCallback((actionId: string) => {
    if (actionId === 'learn_more') {
      openUrlExternal(AAVE_E_MODE_HELP_URL);
    }
  }, []);

  return (
    <HyperlinkText
      testID="borrow-e-mode-description"
      translationId={ETranslations.manage_e_mode__desc}
      size="$bodyMd"
      color="$textSubdued"
      actionTextProps={{ color: '$textInfo' }}
      underlineTextProps={{ color: '$textInfo' }}
      autoExecuteParsedAction={false}
      onAction={handleAction}
    />
  );
}
