import { useMemo } from 'react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';

export const useAllNetworkId = () =>
  useMemo(() => getNetworkIdsMap().onekeyall, []);
