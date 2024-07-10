import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, Stack } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function ExtremelyHighFeeDialogContent({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const intl = useIntl();
  const [checkState, setCheckState] = useState(false as ICheckedState);

  return (
    <>
      <Stack>
        <Checkbox
          value={checkState}
          label={intl.formatMessage({
            id: ETranslations.fee_alert_dialog_checkbox_label,
          })}
          onChange={setCheckState}
        />
      </Stack>
      <Dialog.Footer
        tone="destructive"
        confirmButtonProps={{
          disabled: !checkState,
        }}
        onCancel={onCancel}
        onConfirm={onConfirm}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_continue,
        })}
      />
    </>
  );
}

function usePreCheckFeeInfo({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
  const intl = useIntl();
  const checkFeeInfoIsOverflow = useCallback(
    async ({
      feeAmount,
      feeSymbol,
      encodedTx,
    }: {
      encodedTx: IEncodedTx;
      feeAmount: string;
      feeSymbol: string;
    }) => {
      const { serviceSend, serviceAccount } = backgroundApiProxy;
      const accountAddress = await serviceAccount.getAccountAddressForApi({
        accountId,
        networkId,
      });
      const isFeeInfoOverflow = await serviceSend.preCheckIsFeeInfoOverflow({
        encodedTx,
        feeAmount,
        feeTokenSymbol: feeSymbol,
        networkId,
        accountAddress,
      });

      return isFeeInfoOverflow;
    },
    [accountId, networkId],
  );

  const showFeeInfoOverflowConfirm = useCallback(
    () =>
      new Promise((resolve) => {
        Dialog.show({
          tone: 'destructive',
          icon: 'ErrorOutline',
          title: intl.formatMessage({
            id: ETranslations.fee_alert_dialog_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.fee_alert_dialog_description,
          }),
          onClose: () => resolve(false),
          renderContent: (
            <ExtremelyHighFeeDialogContent
              onConfirm={() => resolve(true)}
              onCancel={() => resolve(false)}
            />
          ),
        });
      }),
    [intl],
  );

  return { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm };
}

export { usePreCheckFeeInfo };
