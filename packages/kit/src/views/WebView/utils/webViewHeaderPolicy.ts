import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function shouldHideWebViewHeaderRight({
  url,
  isWebEmbed,
  hideHeaderRight,
}: {
  url: string;
  isWebEmbed?: boolean;
  hideHeaderRight?: boolean;
}): boolean {
  return Boolean(
    hideHeaderRight ||
    ((platformEnv.isNative || platformEnv.isDesktop) &&
      // Embedded pages can use an HTTP dev server instead of bundled files.
      (isWebEmbed || !/^https?:/i.test(url.trim()))),
  );
}
