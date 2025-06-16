import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, XStack, YStack } from '@onekeyhq/components';
import type { IEarnActivateActionIcon } from '@onekeyhq/shared/types/staking';

import { EarnText } from './EarnText';

function KYCDialogContent({
  data,
  onConfirm,
}: {
  data: IEarnActivateActionIcon['data'];
  onConfirm: (checkboxStates: boolean[]) => Promise<void>;
}) {
  // Initialize checkbox states for all checkbox
  const [checkboxStates, setCheckboxStates] = useState<ICheckedState[]>(
    data.checkboxes.map(() => false),
  );

  const handleCheckboxChange = useCallback(
    (index: number) => (value: ICheckedState) => {
      setCheckboxStates((prev) =>
        prev.map((state, i) => (i === index ? value : state)),
      );
    },
    [],
  );

  const handleConfirm = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        // Convert ICheckedState to boolean for onConfirm callback
        const booleanStates = checkboxStates.map((state) => Boolean(state));
        onConfirm(booleanStates)
          .then(() => resolve())
          .catch(() => reject());
      }),
    [checkboxStates, onConfirm],
  );

  const isConfirmDisabled = checkboxStates.some((state) => !state);

  return (
    <YStack gap="$2">
      {/* Description sections */}
      {data.description.map((desc, index) => (
        <EarnText key={index} text={desc} fontSize="$bodyMd" />
      ))}

      {/* Checkboxes */}
      <YStack gap="$3">
        {data.checkboxes.map((checkbox, index) => (
          <XStack key={index} alignItems="flex-start" gap="$2">
            <Checkbox
              label={checkbox.text}
              value={checkboxStates[index]}
              onChange={handleCheckboxChange(index)}
            />
          </XStack>
        ))}
      </YStack>

      <Dialog.Footer
        onConfirm={handleConfirm}
        onConfirmText={data.title.text}
        confirmButtonProps={{
          disabled: isConfirmDisabled,
        }}
        showCancelButton={false}
      />
    </YStack>
  );
}

export function showKYCDialog({
  actionData,
  onConfirm,
}: {
  actionData: IEarnActivateActionIcon;
  onConfirm: (checkboxStates: boolean[]) => Promise<void>;
}) {
  return Dialog.show({
    icon: 'PassportOutline',
    title: actionData.data.title.text,
    showFooter: false,
    renderContent: (
      <KYCDialogContent data={actionData.data} onConfirm={onConfirm} />
    ),
  });
}
