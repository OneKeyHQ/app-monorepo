import { useCallback, useMemo, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

function RiskNoticeDialogContent({
  onConfirm,
  networkId,
  providerName,
  address,
  operationType,
}: {
  onConfirm: () => Promise<void>;
  networkId: string;
  providerName: string;
  address: string;
  operationType: 'deposit' | 'withdraw';
}) {
  const [checkboxState, setCheckboxState] = useState<ICheckedState>(false);

  const handleCheckboxChange = useCallback((value: ICheckedState) => {
    setCheckboxState(value);
  }, []);

  const handleConfirm = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        // Mark first operation as completed when user confirms
        backgroundApiProxy.simpleDb.earnExtra
          .markFirstOperation(networkId, providerName, address, operationType)
          .then(() => onConfirm())
          .then(() => resolve())
          .catch(() => reject());
      }),
    [onConfirm, networkId, providerName, address, operationType],
  );

  const isConfirmDisabled = !checkboxState;

  const contentText = useMemo(() => {
    if (operationType === 'deposit') {
      return 'You are about to use a service provided by a third party. OneKey is not involved in and has no control over its operations. Please make sure to fully understand and assess the associated risks before proceeding.';
    }
    return 'Withdrawals may affect airdrop eligibility';
  }, [operationType]);

  const checkBoxLabel = useMemo(() => {
    if (operationType === 'deposit') {
      return 'I have understood the risk notice above';
    }
    return 'I have understood the risk notice above';
  }, [operationType]);

  return (
    <YStack gap="$4">
      <SizableText size="$bodyMd" color="$text">
        {contentText}
      </SizableText>

      <XStack alignItems="flex-start" gap="$2">
        <Checkbox
          labelContainerProps={{
            flex: 1,
          }}
          label={checkBoxLabel}
          value={checkboxState}
          onChange={handleCheckboxChange}
          labelProps={{
            variant: '$bodyMdMedium',
          }}
        />
      </XStack>

      <Dialog.Footer
        onConfirm={handleConfirm}
        onConfirmText="Confirm"
        onCancelText="Cancel"
        confirmButtonProps={{
          disabled: isConfirmDisabled,
        }}
        showCancelButton
      />
    </YStack>
  );
}

export function showRiskNoticeDialogBeforeDepositOrWithdraw({
  onConfirm,
  networkId,
  providerName,
  address,
  operationType,
}: {
  onConfirm: () => Promise<void>;
  networkId: string;
  providerName: string;
  address: string;
  operationType: 'deposit' | 'withdraw';
}) {
  const title =
    operationType === 'deposit'
      ? 'Risk notice for using third-party services'
      : 'Withdrawals may affect airdrop eligibility';
  return Dialog.show({
    icon: 'InfoCircleOutline',
    title,
    showFooter: false,
    renderContent: (
      <RiskNoticeDialogContent
        onConfirm={onConfirm}
        networkId={networkId}
        providerName={providerName}
        address={address}
        operationType={operationType}
      />
    ),
  });
}
