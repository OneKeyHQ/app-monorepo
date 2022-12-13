import React, { useMemo } from 'react';

import { useGeneral } from '@onekeyhq/kit/src/hooks/redux';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { CardanoWebEmbedView } from './CardanoWebEmbedView';

function ChainWebEmbed() {
  const { activeNetworkId } = useGeneral();

  const content = useMemo(() => {
    if (!platformEnv.isNative) return null;

    if (!activeNetworkId) return null;

    if (activeNetworkId === 'ada--0') {
      return <CardanoWebEmbedView />;
    }
    return null;
  }, [activeNetworkId]);

  return content;
}

export default React.memo(ChainWebEmbed);
