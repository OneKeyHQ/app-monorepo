export function checkIsEmptyData(data?: string) {
  return !data || data === '0x';
}
