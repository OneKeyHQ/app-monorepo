import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESendFeeStatus } from '@onekeyhq/shared/types/fee';

import { useBulkSendReviewContext } from './Context';

type IProps = {
  onRetry: () => void;
};

function BulkSendReviewAlert({ onRetry }: IProps) {
  const intl = useIntl();
  const { feeState } = useBulkSendReviewContext();
  const { feeStatus, errMessage } = feeState;

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
          isPrimaryLoading: feeStatus === ESendFeeStatus.Loading,
          isPrimaryDisabled: feeStatus === ESendFeeStatus.Loading,
          onPrimaryPress: onRetry,
        }}
      />
    );
  }, [errMessage, intl, onRetry, feeStatus]);

  return <YStack px="$5">{renderFeeErrorAlert()}</YStack>;
}

export default BulkSendReviewAlert;
