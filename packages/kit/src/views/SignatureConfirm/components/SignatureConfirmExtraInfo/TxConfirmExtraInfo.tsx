import { memo } from 'react';

import type { IStackProps } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import {
  IMPL_ALGO,
  IMPL_COSMOS,
  IMPL_DNX,
  IMPL_SOL,
  IMPL_TON,
  IMPL_TRON,
  IMPL_XRP,
} from '@onekeyhq/shared/src/engine/engineConsts';

import TxExtraInfoAlgo from './ExtraInfoAlgo';
import TxExtraInfoCosmos from './ExtraInfoCosmos';
import TxExtraInfoDnx from './ExtraInfoDnx';
import TxExtraInfoSol from './ExtraInfoSol';
import TxExtraInfoTon from './ExtraInfoTon';
import TxExtraInfoTron from './ExtraInfoTron';
import TxExtraInfoXrp from './ExtraInfoXrp';

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
    case IMPL_COSMOS:
      component = TxExtraInfoCosmos;
      break;
    case IMPL_TON:
      component = TxExtraInfoTon;
      break;
    case IMPL_DNX:
      component = TxExtraInfoDnx;
      break;
    case IMPL_XRP:
      component = TxExtraInfoXrp;
      break;
    case IMPL_ALGO:
      component = TxExtraInfoAlgo;
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
      />
    );
  }

  return null;
}

export default memo(TxConfirmExtraInfo);
