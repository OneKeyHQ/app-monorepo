import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, useClipboard } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ReferFriendsTestIDs } from '../../../testIDs';

export function CopyLinkButton({
  url,
  buttonProps,
}: {
  url: string;
  buttonProps?: IButtonProps;
}) {
  const intl = useIntl();
  const { copyUrl } = useClipboard();

  const handleCopy = useCallback(() => {
    copyUrl(url);
  }, [url, copyUrl]);

  return (
    <Button
      testID={ReferFriendsTestIDs.copyLinkBtn}
      variant="secondary"
      size="small"
      onPress={handleCopy}
      {...buttonProps}
    >
      {intl.formatMessage({ id: ETranslations.browser_copy_link })}
    </Button>
  );
}
