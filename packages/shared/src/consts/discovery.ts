export const SEARCH_ITEM_ID = 'SEARCH_ITEM_ID';
export const GOOGLE_LOGO_URL =
  'https://uni.onekey-asset.com/static/logo/google.png';

export function isGoogleSearchItem(dappId: string) {
  return dappId === SEARCH_ITEM_ID;
}
