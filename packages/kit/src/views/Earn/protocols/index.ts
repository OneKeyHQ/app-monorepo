import { EEarnProviderEnum } from '@onekeyhq/shared/types/earn';

import { BabylonEarnProtocol } from './babylon';
import { EarnProtocol } from './EarnProtocol';
import { EthenaEarnProtocol } from './ethena';
import { EtherFiEarnProtocol } from './etherfi';
import { EverstakeEarnProtocol } from './everstake';
import { FalconEarnProtocol } from './falcon';
import { LidoEarnProtocol } from './lido';
import { MorphoEarnProtocol } from './morpho';
import { NativeEarnProtocol } from './native';
import { PendleEarnProtocol } from './pendle';
import { StakefishEarnProtocol } from './stakefish';

export {
  BabylonEarnProtocol,
  EarnProtocol,
  EtherFiEarnProtocol,
  EthenaEarnProtocol,
  EverstakeEarnProtocol,
  FalconEarnProtocol,
  LidoEarnProtocol,
  MorphoEarnProtocol,
  NativeEarnProtocol,
  PendleEarnProtocol,
  StakefishEarnProtocol,
};
export type {
  IEarnStakePlan,
  IEarnStakePlanParams,
  IEarnStakePreparationPolicy,
  IEarnStakeTypeParams,
  IEarnTransactionLayout,
} from './EarnProtocol';

const babylonProtocol = new BabylonEarnProtocol(EEarnProviderEnum.Babylon);
const lidoProtocol = new LidoEarnProtocol(EEarnProviderEnum.Lido);
const morphoProtocol = new MorphoEarnProtocol(EEarnProviderEnum.Morpho);
const stakefishProtocol = new StakefishEarnProtocol(
  EEarnProviderEnum.Stakefish,
);
const nativeProtocol = new NativeEarnProtocol(EEarnProviderEnum.Native);
const etherFiProtocol = new EtherFiEarnProtocol(EEarnProviderEnum.EtherFi);
const ethenaProtocol = new EthenaEarnProtocol(EEarnProviderEnum.Ethena);
const falconProtocol = new FalconEarnProtocol(EEarnProviderEnum.Falcon);
const everstakeProtocol = new EverstakeEarnProtocol(
  EEarnProviderEnum.Everstake,
);
const pendleProtocol = new PendleEarnProtocol(EEarnProviderEnum.Pendle);

export function getEarnProtocol(providerName: string): EarnProtocol {
  switch (providerName.toLowerCase()) {
    case EEarnProviderEnum.Babylon.toLowerCase():
      return babylonProtocol;
    case EEarnProviderEnum.Lido.toLowerCase():
      return lidoProtocol;
    case EEarnProviderEnum.Morpho.toLowerCase():
      return morphoProtocol;
    case EEarnProviderEnum.Stakefish.toLowerCase():
      return stakefishProtocol;
    case EEarnProviderEnum.Native.toLowerCase():
      return nativeProtocol;
    case EEarnProviderEnum.EtherFi.toLowerCase():
      return etherFiProtocol;
    case EEarnProviderEnum.Ethena.toLowerCase():
      return ethenaProtocol;
    case EEarnProviderEnum.Falcon.toLowerCase():
      return falconProtocol;
    case EEarnProviderEnum.Everstake.toLowerCase():
      return everstakeProtocol;
    case EEarnProviderEnum.Pendle.toLowerCase():
      return pendleProtocol;
    default:
      return new EarnProtocol(providerName);
  }
}
