import { EEarnProviderEnum } from '../../types/earn';

import type { IEarnPermitCacheKey } from '../../types/earn';
import type { IEarnText, IEarnToken } from '../../types/staking';
import type { IToken } from '../../types/token';

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

const isListaProvider = createProviderCheck(EEarnProviderEnum.Lista);

const isStakefishProvider = createProviderCheck(EEarnProviderEnum.Stakefish);

const isFalconProvider = createProviderCheck(EEarnProviderEnum.Falcon);

const isEthenaProvider = createProviderCheck(EEarnProviderEnum.Ethena);

const isMomentumProvider = createProviderCheck(EEarnProviderEnum.Momentum);

const isVaultBasedProvider = ({ providerName }: { providerName: string }) => {
  return (
    isMorphoProvider({ providerName }) ||
    isListaProvider({ providerName }) ||
    isMomentumProvider({ providerName })
  );
};

const isValidatorProvider = ({ providerName }: { providerName: string }) => {
  return (
    isEverstakeProvider({ providerName }) ||
    isStakefishProvider({ providerName })
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

function convertEarnTokenToIToken(earnToken?: IEarnToken): IToken | undefined {
  if (!earnToken?.address) {
    return undefined;
  }

  return {
    address: earnToken.address,
    decimals: earnToken.decimals,
    isNative: earnToken.isNative,
    logoURI: earnToken.logoURI,
    name: earnToken.name,
    symbol: earnToken.symbol,
    uniqueKey: earnToken.uniqueKey,
  };
}

function extractAmountFromText(text?: IEarnText): string {
  if (!text?.text) return '0';

  const match = text.text.match(/[\d,.]+/);
  return match ? match[0].replace(/,/g, '') : '0';
}

function buildEarnAccountKey({
  accountId,
  indexAccountId,
  networkId,
}: {
  accountId?: string;
  indexAccountId?: string;
  networkId: string;
}) {
  return `${accountId || indexAccountId || ''}-${networkId}`;
}

export default {
  buildEarnAccountKey,
  getEarnProviderEnumKey,
  isMorphoProvider,
  isListaProvider,
  isLidoProvider,
  isBabylonProvider,
  isEverstakeProvider,
  isStakefishProvider,
  isFalconProvider,
  isEthenaProvider,
  isMomentumProvider,
  getEarnProviderName,
  getEarnPermitCacheKey,
  isUSDTonETHNetwork,
  isVaultBasedProvider,
  isValidatorProvider,
  convertEarnTokenToIToken,
  extractAmountFromText,
};
