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

function isLidoProvider({ providerName }: { providerName: string }) {
  return providerName.toLowerCase() === 'lido';
}

function isBabylonProvider({ providerName }: { providerName: string }) {
  return providerName.toLowerCase() === 'babylon';
}

function isEverstakeProvider({ providerName }: { providerName: string }) {
  return providerName.toLowerCase() === 'everstake';
}

function isMorphoProvider({ providerName }: { providerName: string }) {
  return providerName.toLowerCase() === 'morpho';
}

export default {
  getEarnProviderEnumKey,
  isMorphoProvider,
  isLidoProvider,
  isBabylonProvider,
  isEverstakeProvider,
};
