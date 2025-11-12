import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, useClipboard } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function CopyLinkButton({ url }: { url: string }) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  const handleCopy = useCallback(() => {
    void copyText(url);
  }, [url, copyText]);

  return (
    <Button variant="secondary" size="small" onPress={handleCopy}>
      {intl.formatMessage({ id: ETranslations.browser_copy_link })}
    </Button>
  );
}
