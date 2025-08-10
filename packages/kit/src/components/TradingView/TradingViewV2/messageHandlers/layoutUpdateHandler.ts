import type { IMessageHandlerParams } from './types';

export async function handleLayoutUpdate({
  data,
  context: _context,
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
      console.log('🎨 Layout data parsed successfully:', {
        keys: Object.keys(parsedLayoutData),
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('❌ Failed to parse layout data:', error);
    }
  }
}
