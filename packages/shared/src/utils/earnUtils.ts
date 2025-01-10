import { EEarnProviderEnum } from '../../types/earn';

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

export default {
  getEarnProviderEnumKey,
  isMorphoProvider,
  isLidoProvider,
  isBabylonProvider,
  isEverstakeProvider,
};
