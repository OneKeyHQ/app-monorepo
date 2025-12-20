import { useEffect, useState } from 'react';

import type { IIconButtonProps } from '@onekeyhq/components';
import { IconButton } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useHyperliquidActions } from '../../states/jotai/contexts/hyperliquid';

type IPerpRefreshButtonProps = Omit<
  IIconButtonProps,
  'icon' | 'variant' | 'size' | 'loading' | 'disabled' | 'onPress'
>;

export function PerpRefreshButton(props: IPerpRefreshButtonProps) {
  const actions = useHyperliquidActions();
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const [loading, setLoading] = useState(false);
  const [canRefresh, setCanRefresh] = useState(!!networkStatus.connected);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (networkStatus?.connected) {
      setCanRefresh(true);
    } else {
      setCanRefresh(false);
      timer = setTimeout(() => {
        setCanRefresh(true);
      }, 5000);
    }
    return () => {
      clearTimeout(timer);
    };
  }, [networkStatus?.connected]);

  return (
    <IconButton
      loading={loading}
      disabled={!canRefresh}
      icon="RefreshCwOutline"
      variant="tertiary"
      size="small"
      onPress={async () => {
        try {
          setLoading(true);
          await actions.current.refreshAllPerpsData();
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      }}
      {...props}
    />
  );
}
