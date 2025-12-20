import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import semver from 'semver';

import { ETranslations } from '@onekeyhq/shared/src/locale';

export const useFirmwareVersionValid = () => {
  const intl = useIntl();
  const unknownMessage = intl.formatMessage({
    id: ETranslations.global_unknown,
  });

  const versionValid = useCallback((version: string | undefined) => {
    if (!version) return false;
    if (semver.valid(version)) {
      if (semver.eq(version, '0.0.0')) {
        return false;
      }
      return true;
    }
    return false;
  }, []);

  return {
    versionValid,
    unknownMessage,
  };
};
