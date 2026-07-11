import type { ReactNode } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

function NativeInstantWithdrawFeeContent({
  onConfirm,
}: {
  onConfirm: () => void;
}) {
  const intl = useIntl();
  const [acknowledged, setAcknowledged] = useState<ICheckedState>(false);

  return (
    <YStack gap="$5">
      <SizableText size="$bodyLg">
        {intl.formatMessage(
          { id: ETranslations.defi_native_instant_withdraw_fee__desc },
          {
            // eslint-disable-next-line react/no-unstable-nested-components
            strong: (chunks: ReactNode[]) => (
              <SizableText size="$bodyLgMedium" color="$textCritical">
                {chunks}
              </SizableText>
            ),
          },
        )}
      </SizableText>
      <Checkbox
        testID="native-instant-withdraw-fee-checkbox"
        value={acknowledged}
        label={intl.formatMessage({
          id: ETranslations.wallet_i_understand_risks_and_proceed,
        })}
        onChange={setAcknowledged}
      />
      <Dialog.Footer
        onConfirm={onConfirm}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_confirm,
        })}
        onCancelText={intl.formatMessage({
          id: ETranslations.global_cancel,
        })}
        confirmButtonProps={{
          disabled: !acknowledged,
        }}
      />
    </YStack>
  );
}

export function showNativeInstantWithdrawFeeDialog(
  intl: IntlShape,
): Promise<boolean> {
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = Dialog.show({
      icon: 'InfoCircleOutline',
      title: intl.formatMessage({
        id: ETranslations.defi_native_instant_withdraw_fee__title,
      }),
      showFooter: false,
      onClose: () => resolve(confirmed),
      renderContent: (
        <NativeInstantWithdrawFeeContent
          onConfirm={() => {
            confirmed = true;
            void dialog.close();
          }}
        />
      ),
    });
  });
}
