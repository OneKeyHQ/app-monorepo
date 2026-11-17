import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IEarnRiskNoticeDialog } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTestIDs } from '../testIDs';

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
  const dialogInstance = useDialogInstance();

  const handleCheckboxChange = useCallback((value: ICheckedState) => {
    setCheckboxState(value);
  }, []);

  // A link in the notice navigates away from this dialog, so the dialog has to
  // go first (OK-61348): it lives in its own overlay while the page is pushed
  // onto the navigation stack, and would otherwise still be sitting there when
  // the user comes back. Awaited so the two do not animate over each other.
  const handleBeforeOpenUrl = useCallback(async () => {
    await dialogInstance.close();
  }, [dialogInstance]);

  const handleConfirm = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        const persistNoShow = async () => {
          // Only persist when checkbox is checked, regardless of operation type
          if (checkboxState) {
            await backgroundApiProxy.simpleDb.earnExtra.markFirstOperation(
              networkId,
              providerName,
              address,
              operationType,
            );
          }
        };

        persistNoShow()
          .then(() => onConfirm())
          .then(() => resolve())
          .catch(() => reject(new Error('Risk notice confirmation failed')));
      }),
    [onConfirm, networkId, providerName, address, operationType, checkboxState],
  );

  // Only withdraw operations allow confirmation without checkbox selection
  // All other operations (deposit, etc.) require checkbox to be checked
  const isConfirmDisabled = operationType !== 'withdraw' && !checkboxState;

  return (
    <YStack testID={EarnTestIDs.riskNoticeDialog} gap="$4">
      <EarnText
        size="$bodyMd"
        text={riskNoticeDialogContent.description}
        color="$text"
        onBeforeOpenUrl={handleBeforeOpenUrl}
      />

      {riskNoticeDialogContent.checkboxes.map((checkbox) => (
        <XStack key={checkbox.text} alignItems="flex-start" gap="$2">
          <Checkbox
            testID="earn-is-confirm-disabled-checkbox"
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
          testID: EarnTestIDs.riskNoticeConfirmButton,
        }}
      />
    </YStack>
  );
}

export function showRiskNoticeDialogBeforeDepositOrWithdraw({
  onConfirm,
  onClose,
  networkId,
  providerName,
  address,
  operationType,
  riskNoticeDialogContent,
}: {
  onConfirm: () => Promise<void>;
  onClose?: () => void;
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
    onClose,
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
