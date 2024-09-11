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

export default {
  getEarnProviderEnumKey,
};
