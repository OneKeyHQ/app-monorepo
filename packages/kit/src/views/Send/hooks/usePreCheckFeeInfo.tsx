import { useCallback } from 'react';

import { Dialog } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

function usePreCheckFeeInfo({
  accountId,
  networkId,
}: {
  accountId: string;
  networkId: string;
}) {
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
      const account = await serviceAccount.getAccount({
        accountId,
        networkId,
      });
      const isFeeInfoOverflow = await serviceSend.preCheckIsFeeInfoOverflow({
        encodedTx,
        feeAmount,
        feeTokenSymbol: feeSymbol,
        networkId,
        accountAddress: account.address,
      });

      return isFeeInfoOverflow;
    },
    [accountId, networkId],
  );

  const showFeeInfoOverflowConfirm = useCallback(
    () =>
      new Promise((resolve) => {
        Dialog.show({
          title: 'Fee is too high',
          icon: 'PlaceholderOutline',
          description:
            'Fee is too high, please try to lower the fee or try again later.',
          tone: 'default',
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        });
      }),
    [],
  );

  return { checkFeeInfoIsOverflow, showFeeInfoOverflowConfirm };
}

export { usePreCheckFeeInfo };
