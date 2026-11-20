import type {
  ETranslations,
  ILocaleJSONSymbol,
} from '@onekeyhq/shared/src/locale';
import { getDefaultLocale } from '@onekeyhq/shared/src/locale/getDefaultLocale';
import { loadLocaleMessages } from '@onekeyhq/shared/src/locale/localeLoaders';

import { KEYLESS_DELETION_SUPPORT_EMAIL } from './paths';

// Plain-DOM screens render before React and the intl provider exist. Keep this
// module free of wallet storage so the OAuth callback popup stays lightweight.
const STARTUP_TEXT_IDS = {
  callback: 'keyless_deletion_callback__msg',
  contact: 'keyless_deletion_contact__desc',
  loadFailed: 'keyless_deletion_link_load_failed__title',
  openLink: 'keyless_deletion_open_link__desc',
  retry: 'global.retry',
} as const satisfies Record<string, `${ETranslations}`>;

export type IStartupTextKey = keyof typeof STARTUP_TEXT_IDS;

export async function loadStartupText(
  key: IStartupTextKey,
  locale?: ILocaleJSONSymbol,
): Promise<string | undefined> {
  const catalog = await loadLocaleMessages(
    locale ?? (getDefaultLocale() as ILocaleJSONSymbol),
  );
  return catalog[STARTUP_TEXT_IDS[key]];
}

export function createSupportContact(template: string) {
  const contact = globalThis.document.createElement('p');
  const link = globalThis.document.createElement('a');
  link.href = `mailto:${KEYLESS_DELETION_SUPPORT_EMAIL}`;
  link.textContent = KEYLESS_DELETION_SUPPORT_EMAIL;
  const [before = '', after = ''] = template.split('{email}');
  contact.append(before, link, after);
  return contact;
}
