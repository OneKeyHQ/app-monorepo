export const setSecureItem = async (key: string, data: string) =>
  window?.desktopApi.secureSetItemAsync(key, data);

export const getSecureItem = async (key: string) =>
  window?.desktopApi.secureGetItemAsync(key);

export const removeSecureItem = async (key: string) =>
  window?.desktopApi.secureDelItemAsync(key);
