import { memo } from 'react';

import type { IStackProps } from '@onekeyhq/components';
import { Stack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import { IMPL_SOL, IMPL_TRON } from '@onekeyhq/shared/src/engine/engineConsts';

import TxExtraInfoSol from './ExtraInfoSol';
import TxExtraInfoTron from './ExtraInfoTron';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedTxs: IUnsignedTxPro[];
};

export function getTxExtraInfo({ impl }: { impl: string }) {
  let component:
    | ((props: {
        accountId: string;
        networkId: string;
        unsignedTxs: IUnsignedTxPro[];
        style?: IStackProps;
      }) => React.ReactNode | null)
    | undefined;
  switch (impl) {
    case IMPL_SOL:
      component = TxExtraInfoSol;
      break;
    case IMPL_TRON:
      component = TxExtraInfoTron;
      break;
    default:
      break;
  }

  return component;
}

function TxConfirmExtraInfo(props: IProps) {
  const { accountId, networkId, unsignedTxs } = props;
  const { network } = useAccountData({ networkId });
  const TxExtraInfo = getTxExtraInfo({ impl: network?.impl ?? '' });

  if (TxExtraInfo) {
    return (
      <TxExtraInfo
        accountId={accountId}
        networkId={networkId}
        unsignedTxs={unsignedTxs}
        style={{
          pt: '$5',
        }}
      />
    );
  }

  return null;
}

export default memo(TxConfirmExtraInfo);
