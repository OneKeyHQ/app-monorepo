/* eslint-disable @typescript-eslint/no-unused-vars */
import type { HardwarePopup } from './showHardwarePopup.consts';

export function closeHardwarePopup() {
  console.error('closeHardwarePopup: Do nothing in ext-bg');
}
export default async function showHardwarePopup({
  uiRequest,
  payload,
  content,
}: HardwarePopup) {
  console.error('showHardwarePopup: Do nothing in ext-bg');
  return Promise.resolve(null);
}
