import '@onekeyhq/shared/src/polyfills';

import { getKeylessEntry } from './src/keylessDeletion/entry';
import { KEYLESS_DELETION_SUPPORT_EMAIL } from './src/keylessDeletion/paths';

async function showKeylessLoadError(root) {
  const notice = globalThis.document.createElement('p');
  notice.role = 'alert';
  // English fallbacks stay visible if the locale catalogue itself fails to load.
  notice.textContent = 'Unable to Open Deletion Link';
  const retry = globalThis.document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Retry';
  retry.onclick = () => globalThis.location.reload();
  const contact = globalThis.document.createElement('p');
  const email = globalThis.document.createElement('a');
  email.href = `mailto:${KEYLESS_DELETION_SUPPORT_EMAIL}`;
  email.textContent = KEYLESS_DELETION_SUPPORT_EMAIL;
  contact.append('Need help? Email ', email);
  root.replaceChildren(notice, retry, contact);
  try {
    const [{ readPreferredLocale }, { createSupportContact, loadStartupText }] =
      await Promise.all([
        import('./src/keylessDeletion/localePreference'),
        import('./src/keylessDeletion/startupText'),
      ]);
    const locale = await readPreferredLocale();
    const [title, label, template] = await Promise.all([
      loadStartupText('loadFailed', locale),
      loadStartupText('retry', locale),
      loadStartupText('contact', locale),
    ]);
    if (title) notice.textContent = title;
    if (label) retry.textContent = label;
    if (template) contact.replaceWith(createSupportContact(template));
  } catch {
    // Keep the retry action available when translation resources fail to load.
  }
}

async function openKeylessRoute(root, kind) {
  // Install in this branch so wallet hydration still precedes its lockdown.
  await import(
    /* webpackMode: "eager" */ '@onekeyhq/shared/src/security/sesHarden/installWeb'
  );
  // The callback URL carries the OAuth code, so set this before loading chunks.
  const referrer = globalThis.document.createElement('meta');
  referrer.name = 'referrer';
  referrer.content = 'no-referrer';
  globalThis.document.head.append(referrer);
  if (kind === 'callback') {
    // The opener closes this popup; the text only helps if it stays open.
    root.textContent =
      (await import('./src/keylessDeletion/startupText')
        .then(({ loadStartupText }) => loadStartupText('callback'))
        .catch(() => undefined)) ?? '';
    return;
  }

  globalThis.document
    .querySelector('meta[name="viewport"]')
    ?.setAttribute(
      'content',
      'width=device-width, initial-scale=1, viewport-fit=cover',
    );
  const { mount } = await import('./src/keylessDeletion/mountAppRoute');
  await mount(root);
}

const keylessEntry = getKeylessEntry(new URL(globalThis.location.href));
if (!keylessEntry) {
  void import(/* webpackMode: "eager" */ './startWalletApp');
} else {
  const root = globalThis.document.getElementById('root');
  void openKeylessRoute(root, keylessEntry.kind).catch(() =>
    showKeylessLoadError(root),
  );
}
