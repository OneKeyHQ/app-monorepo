import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EthereumMatic,
  SepoliaMatic,
} from '@onekeyhq/shared/src/consts/addresses';

type IAssetSupported = 'eth' | 'matic' | 'sol' | 'apt' | 'atom';
type IAssetSupportedCheckParams = {
  networkId: string;
  tokenAddress: string;
};

type IAssetSupportedChecker = (
  params: IAssetSupportedCheckParams,
) => IAssetSupported | undefined;

const ethChecker: IAssetSupportedChecker = ({ networkId, tokenAddress }) =>
  [
    getNetworkIdsMap().eth,
    getNetworkIdsMap().sepolia,
    getNetworkIdsMap().holesky,
  ].includes(networkId) && !tokenAddress
    ? 'eth'
    : undefined;

const maticChecker: IAssetSupportedChecker = ({ networkId, tokenAddress }) =>
  (networkId === getNetworkIdsMap().eth &&
    tokenAddress.toLowerCase() === EthereumMatic) ||
  (networkId === getNetworkIdsMap().sepolia &&
    tokenAddress.toLowerCase() === SepoliaMatic)
    ? 'matic'
    : undefined;

const aptChecker: IAssetSupportedChecker = ({ networkId, tokenAddress }) =>
  networkId === getNetworkIdsMap().apt &&
  tokenAddress === '0x1::aptos_coin::AptosCoin'
    ? 'apt'
    : undefined;

const atomChecker: IAssetSupportedChecker = ({ networkId, tokenAddress }) =>
  networkId === getNetworkIdsMap().cosmoshub && tokenAddress === 'uatom'
    ? 'atom'
    : undefined;

const solChecker: IAssetSupportedChecker = ({ networkId, tokenAddress }) =>
  networkId === getNetworkIdsMap().sol && !tokenAddress ? 'sol' : undefined;

export const assetChecker: IAssetSupportedChecker = (params) => {
  const checkerList: IAssetSupportedChecker[] = [
    ethChecker,
    maticChecker,
    aptChecker,
    atomChecker,
    solChecker,
  ];
  for (let i = 0; i < checkerList.length; i += 1) {
    const checker = checkerList[i];
    const result = checker(params);
    if (result) {
      return result;
    }
  }
};
