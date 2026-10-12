import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, Stack } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { markTxFeeOverflowConfirmOpen } from './txFeeOverflowConfirmPresence';

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
          testID="verify-tx-fee-checkbox"
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
          testID: 'verify-tx-fee-confirm-btn',
          disabled: !checkState,
        }}
        cancelButtonProps={{
          testID: 'verify-tx-fee-cancel-btn',
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

function usePreCheckFeeInfo() {
  const intl = useIntl();
  const checkFeeInfoIsOverflow = useCallback(
    async ({
      accountId,
      networkId,
      feeAmount,
      feeSymbol,
      encodedTx,
    }: {
      accountId: string;
      networkId: string;
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
    [],
  );

  const showFeeInfoOverflowConfirm = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        // Published for flows that own a system-level presentation covering
        // this RN-layer dialog on native (the WalletConnect Pay sheet parks
        // for it, see txFeeOverflowConfirmPresence). Cleared on every way
        // the dialog can settle; the mark tolerates the button and onClose
        // both firing.
        const markClosed = markTxFeeOverflowConfirmOpen();
        const settle = (isConfirmed: boolean) => {
          markClosed();
          resolve(isConfirmed);
        };
        Dialog.show({
          tone: 'destructive',
          icon: 'ErrorOutline',
          title: intl.formatMessage({
            id: ETranslations.fee_alert_dialog_title,
          }),
          description: intl.formatMessage({
            id: ETranslations.fee_alert_dialog_description,
          }),
          onClose: () => settle(false),
          renderContent: (
            <ExtremelyHighFeeDialogContent
              onConfirm={() => settle(true)}
              onCancel={() => settle(false)}
            />
          ),
        });
      }),
    [intl],
  );

  return { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm };
}

export { usePreCheckFeeInfo };
