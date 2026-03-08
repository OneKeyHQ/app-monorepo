import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';
import type { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';

type IUseBulkSendMobileHeaderOptions = {
  bulkSendMode: EBulkSendMode;
};

export function useBulkSendMobileHeader({
  bulkSendMode,
}: IUseBulkSendMobileHeaderOptions) {
  const intl = useIntl();
  const renderHeaderTitle = useCallback(
    () => (
      <YStack
        {...(platformEnv.isNativeIOS && {
          alignItems: 'center',
        })}
      >
        <SizableText
          size="$headingLg"
          {...(platformEnv.isNativeIOS && {
            textAlign: 'center',
          })}
        >
          {intl.formatMessage({ id: ETranslations.wallet_bulk_send_title })}
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          {...(platformEnv.isNativeIOS && {
            textAlign: 'center',
          })}
        >
          {bulkSendUtils.getBulkSendModeLabel(bulkSendMode)}
        </SizableText>
      </YStack>
    ),
    [intl, bulkSendMode],
  );

  return {
    headerTitle: renderHeaderTitle,
  };
}

export default useBulkSendMobileHeader;
