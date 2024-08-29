import { useEffect, useMemo, useState } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';

import type { ColorTokens } from 'tamagui';

const ICON_CONFIG_LIST = {
  [EHostSecurityLevel.Unknown]: {
    iconName: 'InfoCircleOutline',
    iconColor: '$iconSubdued',
  },
  [EHostSecurityLevel.Security]: {
    iconName: 'InfoCircleSolid',
    iconColor: '$iconSuccess',
  },
  [EHostSecurityLevel.Medium]: {
    iconName: 'InfoSquareSolid',
    iconColor: '$iconCaution',
  },
  [EHostSecurityLevel.High]: {
    iconName: 'ErrorSolid',
    iconColor: '$iconCritical',
  },
};

export function useUrlRiskConfig(url: string) {
  const [hostSecurity, setHostSecurity] = useState<IHostSecurity | undefined>();
  useEffect(() => {
    void backgroundApiProxy.serviceDiscovery
      .checkUrlSecurity(url)
      .then(setHostSecurity);
  }, [url]);
  const iconConfig = useMemo(() => {
    if (!hostSecurity?.level) {
      return { iconName: 'LoaderOutline', iconColor: '$iconSubdued' } as {
        iconName: IKeyOfIcons;
        iconColor: ColorTokens;
      };
    }
    return ICON_CONFIG_LIST[
      hostSecurity?.level ?? EHostSecurityLevel.Unknown
    ] as {
      iconName: IKeyOfIcons;
      iconColor: ColorTokens;
    };
  }, [hostSecurity?.level]);
  return useMemo(
    () => ({
      iconConfig,
      hostSecurity,
    }),
    [iconConfig, hostSecurity],
  );
}
