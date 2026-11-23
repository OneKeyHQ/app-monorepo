import { createNamedIcon } from '@onekeyfe/react-native-image/icon/dom';

/** The SVG `<use>` target of a named icon in the app's icon table. */
export function getToastIconHref(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  return (
    createNamedIcon(document, name)
      .querySelector('use')
      ?.getAttribute('href') ?? undefined
  );
}
