import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Spinner,
  Stack,
  View,
  useMedia,
} from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MarketWatchListProviderMirrorV2 } from '../../../MarketWatchListProviderMirrorV2';

import { SwapPanelWrap } from './SwapPanelWrap';

export function SwapPanel({
  networkId,
  tokenAddress,
}: {
  networkId?: string;
  tokenAddress?: string;
}) {
  const intl = useIntl();
  const media = useMedia();
  const dialogRef = useRef<ReturnType<typeof Dialog.show>>(undefined);

  useEffect(() => {
    if (!media.md) {
      void dialogRef.current?.close();
    }
  }, [media.md]);

  if (!networkId || !tokenAddress) {
    return (
      <Stack
        minHeight={400}
        justifyContent="center"
        alignItems="center"
        width="full"
      >
        <Spinner />
      </Stack>
    );
  }

  const showSwapDialog = () => {
    dialogRef.current = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_swap }),
      renderContent: <SwapPanelWrap />,
      showFooter: false,
    });
  };

  if (media.md) {
    return (
      <View p="$3">
        <Button size="large" variant="primary" onPress={() => showSwapDialog()}>
          {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
        </Button>
      </View>
    );
  }

  return (
    <View>
      <SwapPanelWrap />
    </View>
  );
}
