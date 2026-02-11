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

  if (!errMessage) {
    return null;
  }

  return (
    <YStack px="$5">
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
    </YStack>
  );
}

export default BulkSendReviewAlert;
