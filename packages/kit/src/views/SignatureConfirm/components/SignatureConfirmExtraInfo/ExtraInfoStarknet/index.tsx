import { memo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IStackProps, IYStackProps } from '@onekeyhq/components';
import type { IDecodedTxExtraStarknet } from '@onekeyhq/core/src/chains/starknet/types';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import {
  useDecodedTxsAtom,
  useSendSelectedFeeInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { formatMockMessage } from '@onekeyhq/kit/src/views/StarknetPrivacy/utils/starknetPrivacyUtils';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoStarknet({
  networkId,
  style,
}: {
  networkId: string;
  style?: IStackProps;
}) {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();
  const { network } = useAccountData({ networkId });

  const decodedTx = decodedTxs?.[0];

  const extraInfo = decodedTx?.extraInfo as IDecodedTxExtraStarknet;

  if (!decodedTx || !extraInfo || !extraInfo.deployAccountFee) return null;

  // FRI decimal strings. The node's estimate is what the headline fee uses;
  // the decoded tx only carries the bound, a fallback until the estimate lands.
  const estimate =
    sendSelectedFeeInfo?.feeInfos?.[0]?.feeInfo.feeStarknet
      ?.deployAccountOverallFee;
  const amount = numberFormat(
    new BigNumber(estimate ?? extraInfo.deployAccountFee)
      .shiftedBy(-(network?.decimals ?? 0))
      .toFixed(),
    { formatter: 'balance' },
  );

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
      <SignatureConfirmItem.Label>
        {formatMockMessage(
          intl,
          ETranslationsMock.starknet_account_activation_one_time,
        )}
      </SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>
        {`${amount} ${network?.symbol ?? ''}`}
      </SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoStarknet);
