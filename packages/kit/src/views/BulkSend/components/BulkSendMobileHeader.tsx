import { useCallback } from 'react';

import { SizableText, YStack } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import bulkSendUtils from '@onekeyhq/shared/src/utils/bulkSendUtils';

type IUseBulkSendMobileHeaderOptions = {
  bulkSendMode: EBulkSendMode;
};

export function useBulkSendMobileHeader({
  bulkSendMode,
}: IUseBulkSendMobileHeaderOptions) {
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
          Bulk send
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
    [bulkSendMode],
  );

  return {
    headerTitle: renderHeaderTitle,
  };
}

export default useBulkSendMobileHeader;
