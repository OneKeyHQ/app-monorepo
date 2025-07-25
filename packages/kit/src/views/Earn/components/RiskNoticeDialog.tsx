import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IEarnRiskNoticeDialog } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';

function RiskNoticeDialogContent({
  onConfirm,
  networkId,
  providerName,
  address,
  operationType,
  riskNoticeDialogContent,
}: {
  onConfirm: () => Promise<void>;
  networkId: string;
  providerName: string;
  address: string;
  operationType: 'deposit' | 'withdraw';
  riskNoticeDialogContent: IEarnRiskNoticeDialog;
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

  return (
    <YStack gap="$4">
      <EarnText
        size="$bodyMd"
        text={riskNoticeDialogContent.description}
        color="$text"
      />

      {riskNoticeDialogContent.checkboxes.map((checkbox) => (
        <XStack key={checkbox.text} alignItems="flex-start" gap="$2">
          <Checkbox
            labelContainerProps={{
              flex: 1,
            }}
            label={checkbox.text}
            value={checkboxState}
            onChange={handleCheckboxChange}
            labelProps={{
              variant: '$bodyMdMedium',
            }}
          />
        </XStack>
      ))}

      <Dialog.Footer
        showConfirmButton
        showCancelButton
        onConfirm={handleConfirm}
        confirmButtonProps={{
          disabled: isConfirmDisabled,
        }}
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
  riskNoticeDialogContent,
}: {
  onConfirm: () => Promise<void>;
  networkId: string;
  providerName: string;
  address: string;
  operationType: 'deposit' | 'withdraw';
  riskNoticeDialogContent: IEarnRiskNoticeDialog;
}) {
  return Dialog.show({
    icon: 'InfoCircleOutline',
    title: riskNoticeDialogContent.title.text,
    showFooter: false,
    renderContent: (
      <RiskNoticeDialogContent
        onConfirm={onConfirm}
        networkId={networkId}
        providerName={providerName}
        address={address}
        operationType={operationType}
        riskNoticeDialogContent={riskNoticeDialogContent}
      />
    ),
  });
}
