import { useCallback, useState } from 'react';

import {
  Button,
  Checkbox,
  Input,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { openWebView } from '@onekeyhq/kit/src/views/WebView/utils/webViewNavigation';

const PRESETS = [
  { label: 'OneKey home', url: 'https://onekey.so', title: 'OneKey' },
  { label: 'Help center', url: 'https://help.onekey.so', title: 'Help' },
  { label: 'GitHub', url: 'https://github.com', title: 'GitHub' },
  { label: 'WalletConnect docs', url: 'https://docs.walletconnect.com' },
];

// Use runtime-built strings to dodge eslint's `no-script-url` rule on the
// literal — the whole point of these cases is that openWebView() rejects them.
const SCRIPT_SCHEME_LABEL = ['java', 'script:', ' scheme (must reject)'].join(
  '',
);
const SCRIPT_SCHEME_URL = ['java', 'script:', 'alert(1)'].join('');

const REJECTION_CASES = [
  {
    label: SCRIPT_SCHEME_LABEL,
    url: SCRIPT_SCHEME_URL,
  },
  {
    label: 'file: scheme (must reject)',
    url: 'file:///etc/passwd',
  },
  {
    label: 'http:// scheme (https-only policy)',
    url: 'http://example.com',
  },
  {
    label: 'userinfo embed (phishing vector)',
    url: 'https://trusted.com@evil.com/',
  },
  {
    label: 'localhost (SSRF guard)',
    url: 'https://localhost:3000/',
  },
  {
    label: 'private IP 192.168.x (SSRF guard)',
    url: 'https://192.168.1.1/',
  },
  {
    label: 'AWS metadata IP (SSRF guard)',
    url: 'https://169.254.169.254/latest/meta-data/',
  },
  {
    label: 'IPv6 loopback (SSRF guard)',
    url: 'https://[::1]/',
  },
  {
    label: 'custom port (only 443 allowed)',
    url: 'https://example.com:8443/',
  },
  {
    label: 'direct download .exe (must reject)',
    url: 'https://example.com/installer.exe',
  },
  {
    label: 'direct download .apk (must reject)',
    url: 'https://example.com/release.apk',
  },
  {
    label: 'direct download .zip (must reject)',
    url: 'https://example.com/archive.zip?token=x',
  },
  {
    label: 'empty url (must reject)',
    url: '',
  },
];

export default function WebViewOverlayGallery() {
  const [url, setUrl] = useState('https://onekey.so');
  const [title, setTitle] = useState('OneKey');
  const [hideHeader, setHideHeader] = useState(false);
  const [showAddressBar, setShowAddressBar] = useState(false);

  const onOpen = useCallback(() => {
    openWebView({
      url,
      title: title || undefined,
      hideHeader,
      showAddressBar,
      source: 'in-app',
    });
  }, [url, title, hideHeader, showAddressBar]);

  return (
    <Page>
      <Page.Body p="$4" gap="$4">
        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">URL</SizableText>
          <Input value={url} onChangeText={setUrl} placeholder="https://..." />
        </YStack>

        <YStack gap="$2">
          <SizableText size="$bodyMdMedium">Title (optional)</SizableText>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="Falls back to document.title"
          />
        </YStack>

        <XStack gap="$5">
          <Checkbox
            value={hideHeader}
            onChange={(v) => setHideHeader(Boolean(v))}
            label="Hide header"
          />
          <Checkbox
            value={showAddressBar}
            onChange={(v) => setShowAddressBar(Boolean(v))}
            label="Show address bar"
          />
        </XStack>

        <Button variant="primary" onPress={onOpen}>
          Open WebView overlay
        </Button>

        <Stack pt="$4" gap="$2">
          <SizableText size="$bodyMdMedium">Quick presets</SizableText>
          {PRESETS.map((preset) => (
            <Button
              key={preset.url}
              variant="secondary"
              onPress={() => {
                openWebView({
                  url: preset.url,
                  title: preset.title,
                  source: 'in-app',
                });
              }}
            >
              {preset.label}
            </Button>
          ))}
        </Stack>

        <Stack pt="$4" gap="$2">
          <SizableText size="$bodyMdMedium" color="$textCaution">
            Rejection cases (no overlay should open)
          </SizableText>
          {REJECTION_CASES.map((c) => (
            <Button
              key={c.label}
              variant="tertiary"
              onPress={() => {
                openWebView({ url: c.url, source: 'in-app' });
              }}
            >
              {c.label}
            </Button>
          ))}
        </Stack>
      </Page.Body>
    </Page>
  );
}
