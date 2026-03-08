import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

function LiquidationRiskDialogContent({
  onConfirm,
  intl,
}: {
  onConfirm: () => Promise<void>;
  intl: IntlShape;
}) {
  const [acknowledged, setAcknowledged] = useState<ICheckedState>(false);

  const handleConfirm = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        onConfirm()
          .then(() => resolve())
          .catch(() =>
            reject(new Error('Liquidation risk confirmation failed')),
          );
      }),
    [onConfirm],
  );

  const isConfirmDisabled = !acknowledged;

  return (
    <YStack gap="$5">
      <SizableText size="$bodyMd">
        {intl.formatMessage({
          id: ETranslations.defi_liquidation_borrow_desc,
        })}
      </SizableText>

      <Checkbox
        labelContainerProps={{
          flex: 1,
        }}
        label={intl.formatMessage({
          id: ETranslations.defi_liquidation_acknowledge,
        })}
        value={acknowledged}
        onChange={setAcknowledged}
        labelProps={{
          variant: '$bodyMdMedium',
        }}
      />

      <Dialog.Footer
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_confirm })}
        onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
        confirmButtonProps={{
          disabled: isConfirmDisabled,
        }}
      />
    </YStack>
  );
}

export function showLiquidationRiskDialog(intl: IntlShape): Promise<boolean> {
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = Dialog.show({
      icon: 'InfoCircleOutline',
      title: intl.formatMessage({
        id: ETranslations.defi_liquidation_reminder,
      }),
      showFooter: false,
      onClose: () => resolve(confirmed),
      renderContent: (
        <LiquidationRiskDialogContent
          intl={intl}
          onConfirm={async () => {
            confirmed = true;
            await dialog.close();
          }}
        />
      ),
    });
  });
}
