import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import type { IMessageHandlerContext } from './types';

export const VOLUME_VISIBILITY_UPDATE = 'VOLUME_VISIBILITY_UPDATE';

type IVolumeVisibilityUpdateSource = 'history' | 'realtime';

function getPointVolume(
  point: IMarketTokenKLineResponse['points'][number],
): number {
  const volume = Number(point.v ?? 0);
  return Number.isFinite(volume) ? volume : Number.NaN;
}

export function getVolumeHiddenState(
  kLineData?: IMarketTokenKLineResponse | null,
): boolean | undefined {
  const points = kLineData?.points;
  if (!points?.length) {
    return undefined;
  }

  return points.every((point) => getPointVolume(point) <= 0);
}

export function sendVolumeVisibilityUpdate({
  allowHide = true,
  kLineData,
  source,
  symbol,
  webRef,
}: {
  allowHide?: boolean;
  kLineData?: IMarketTokenKLineResponse | null;
  source: IVolumeVisibilityUpdateSource;
  symbol?: string;
  webRef: IMessageHandlerContext['webRef'];
}) {
  const hidden = getVolumeHiddenState(kLineData);
  const webView = webRef.current;

  if (hidden === undefined || (!allowHide && hidden) || !webView) {
    return;
  }

  webView.sendMessageViaInjectedScript({
    type: VOLUME_VISIBILITY_UPDATE,
    payload: {
      hidden,
      source,
      symbol,
      timestamp: Date.now(),
    },
  });
}
