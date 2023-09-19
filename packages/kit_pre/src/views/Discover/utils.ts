export const getUrlHost = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};
