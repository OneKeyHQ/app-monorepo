import { memo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IStackProps, IYStackProps } from '@onekeyhq/components';
import {
  useDecodedTxsAtom,
  useSendSelectedFeeInfoAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { formatMockMessage } from '@onekeyhq/kit/src/views/StarknetPrivacy/utils/starknetPrivacyUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IDecodedTxExtraStarknet } from '@onekeyhq/shared/types/starknetPrivacy';

import { SignatureConfirmItem } from '../../SignatureConfirmItem';

function TxExtraInfoStarknet({
  network,
  style,
}: {
  network: IServerNetwork;
  style?: IStackProps;
}) {
  const intl = useIntl();
  const [{ decodedTxs }] = useDecodedTxsAtom();
  const [sendSelectedFeeInfo] = useSendSelectedFeeInfoAtom();

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
      .shiftedBy(-network.decimals)
      .toFixed(),
    { formatter: 'balance' },
  );

  return (
    <SignatureConfirmItem {...(style as IYStackProps)}>
      <SignatureConfirmItem.Label>
        {formatMockMessage(
          intl,
          ETranslations.starknet_account_activation__title,
        )}
      </SignatureConfirmItem.Label>
      <SignatureConfirmItem.Value>
        {`${amount} ${network.symbol}`}
      </SignatureConfirmItem.Value>
    </SignatureConfirmItem>
  );
}

export default memo(TxExtraInfoStarknet);
