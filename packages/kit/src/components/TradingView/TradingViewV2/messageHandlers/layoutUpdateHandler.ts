import { tradingViewTimezoneAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';

import type { IMessageHandlerParams } from './types';

type UnknownRecord = Record<string, unknown>;

const MAX_TIMEZONE_SEARCH_DEPTH = 8;

const findTimezoneInLayout = (
  node: unknown,
  depth = 0,
  visited = new Set<unknown>(),
): string | undefined => {
  if (!node || typeof node !== 'object') return undefined;
  if (visited.has(node)) return undefined;
  if (depth > MAX_TIMEZONE_SEARCH_DEPTH) return undefined;
  visited.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findTimezoneInLayout(item, depth + 1, visited);
      if (found) return found;
    }
    return undefined;
  }

  const record = node as UnknownRecord;
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === 'timezone' && typeof value === 'string') {
      return value;
    }
  }

  for (const value of Object.values(record)) {
    const found = findTimezoneInLayout(value, depth + 1, visited);
    if (found) return found;
  }

  return undefined;
};

export async function handleLayoutUpdate({
  data,
  context,
}: IMessageHandlerParams): Promise<void> {
  console.log('✅ Layout update method matched!');

  // Safely extract layout data with proper type checking
  const messageData = data.data;
  if (
    messageData &&
    typeof messageData === 'object' &&
    'layout' in messageData
  ) {
    // Extract layout property safely
    const safeData = messageData as unknown as Record<string, unknown>;
    const layoutString = safeData.layout as string;

    console.log('📡 TradingView layout update received:', data);

    try {
      const parsedLayoutData = JSON.parse(layoutString);

      const timezone = findTimezoneInLayout(parsedLayoutData);
      if (timezone) {
        const currentTimezone = await tradingViewTimezoneAtom.get();
        if (currentTimezone !== timezone) {
          void tradingViewTimezoneAtom.set(timezone);
        }
      }

      // Extract and count panes
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const charts = parsedLayoutData?.charts;
      if (Array.isArray(charts) && charts.length > 0) {
        const firstChart = charts[0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const panes = firstChart?.panes;
        const panesCount = Array.isArray(panes) ? panes.length : 0;

        console.log('📊 Panes count:', panesCount);

        // Trigger the panes count change event
        if (context.onPanesCountChange) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          context.onPanesCountChange(panesCount);
        }
      }

      // console.log('🎨 Layout data parsed successfully:', {
      //   keys: Object.keys(parsedLayoutData),
      //   timestamp: Date.now(),
      // });
    } catch (error) {
      console.error('❌ Failed to parse layout data:', error);
    }
  }
}
