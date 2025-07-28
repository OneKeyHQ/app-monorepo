import { EEarnProviderEnum } from '../../types/earn';

import type { IEarnPermitCacheKey } from '../../types/earn';

function getEarnProviderEnumKey(
  providerString: string,
): EEarnProviderEnum | undefined {
  const normalizedInput = providerString.toLowerCase();

  for (const key in EEarnProviderEnum) {
    if (
      EEarnProviderEnum[key as keyof typeof EEarnProviderEnum].toLowerCase() ===
      normalizedInput
    ) {
      return EEarnProviderEnum[key as keyof typeof EEarnProviderEnum];
    }
  }

  return undefined;
}

function createProviderCheck(provider: EEarnProviderEnum) {
  return ({ providerName }: { providerName: string }) =>
    providerName.toLowerCase() === provider.toLowerCase();
}

const isLidoProvider = createProviderCheck(EEarnProviderEnum.Lido);

const isBabylonProvider = createProviderCheck(EEarnProviderEnum.Babylon);

const isEverstakeProvider = createProviderCheck(EEarnProviderEnum.Everstake);

const isMorphoProvider = createProviderCheck(EEarnProviderEnum.Morpho);

const isFalconProvider = createProviderCheck(EEarnProviderEnum.Falcon);

const isEthenaProvider = createProviderCheck(EEarnProviderEnum.Ethena);

const isMomentumProvider = createProviderCheck(EEarnProviderEnum.Momentum);

const useVaultProvider = ({ providerName }: { providerName: string }) => {
  return (
    isMorphoProvider({ providerName }) || isMomentumProvider({ providerName })
  );
};

function getEarnProviderName({
  providerName,
}: {
  providerName: string;
}): string {
  const normalizedInput = providerName.toLowerCase();
  const enumValues = Object.values(EEarnProviderEnum);

  return (
    enumValues.find((value) => value.toLowerCase() === normalizedInput) ??
    'Unknown'
  );
}

function getEarnPermitCacheKey(payload: IEarnPermitCacheKey) {
  return `${payload.accountId}_${payload.networkId}_${payload.tokenAddress}_${payload.amount}`;
}

function isUSDTonETHNetwork({
  networkId,
  symbol,
}: {
  networkId?: string;
  symbol?: string;
}) {
  return networkId === 'evm--1' && symbol === 'USDT';
}

export default {
  getEarnProviderEnumKey,
  isMorphoProvider,
  isLidoProvider,
  isBabylonProvider,
  isEverstakeProvider,
  isFalconProvider,
  isEthenaProvider,
  isMomentumProvider,
  getEarnProviderName,
  getEarnPermitCacheKey,
  isUSDTonETHNetwork,
  useVaultProvider,
};
