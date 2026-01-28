import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

type IProps = {
  feeStatus: ESendFeeStatus;
  errMessage: string;
  isRetrying?: boolean;
  onRetry: () => void;
};

function BulkSendReviewAlert({
  feeStatus,
  errMessage,
  isRetrying,
  onRetry,
}: IProps) {
  const intl = useIntl();

  const renderFeeErrorAlert = useCallback(() => {
    if (!errMessage) {
      return null;
    }

    return (
      <Alert
        icon="ErrorOutline"
        type="critical"
        title={errMessage}
        action={{
          primary: intl.formatMessage({
            id: ETranslations.global_retry,
          }),
          isPrimaryLoading: isRetrying || feeStatus === ESendFeeStatus.Loading,
          isPrimaryDisabled: feeStatus === ESendFeeStatus.Loading,
          onPrimaryPress: onRetry,
        }}
      />
    );
  }, [errMessage, intl, isRetrying, onRetry, feeStatus]);

  return <YStack px="$5">{renderFeeErrorAlert()}</YStack>;
}

export default BulkSendReviewAlert;
