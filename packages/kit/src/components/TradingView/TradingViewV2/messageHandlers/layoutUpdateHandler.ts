import type { IMessageHandlerParams } from './types';

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
