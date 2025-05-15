// This stub is used on web/desktop/extensions where the screenshot feature is not needed.
export const useTakeScreenshot = (_id?: string | null) => () =>
  Promise.resolve(true);
