import type { IOffscreenApi } from './instance/IOffscreenApi';

export const OFFSCREEN_API_MESSAGE_TYPE = 'EXTENSION_MESSAGE_BG_TO_OFFSCREEN';
export interface IOffscreenApiMessagePayload {
  type: typeof OFFSCREEN_API_MESSAGE_TYPE;
  module: keyof IOffscreenApi;
  method: string;
  params: any[];
}
