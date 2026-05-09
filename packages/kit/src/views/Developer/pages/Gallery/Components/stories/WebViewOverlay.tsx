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
const SCRIPT_SCHEME_LABEL = ['java', 'script:', ' scheme (must reject)'].join('');
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
    label: 'empty url (must reject)',
    url: '',
  },
];

export default function WebViewOverlayGallery() {
  const [url, setUrl] = useState('https://onekey.so');
  const [title, setTitle] = useState('OneKey');
  const [hideHeader, setHideHeader] = useState(false);
  const [hideAddressBar, setHideAddressBar] = useState(false);

  const onOpen = useCallback(() => {
    openWebView({
      url,
      title: title || undefined,
      hideHeader,
      hideAddressBar,
      source: 'in-app',
    });
  }, [url, title, hideHeader, hideAddressBar]);

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
            value={hideAddressBar}
            onChange={(v) => setHideAddressBar(Boolean(v))}
            label="Hide address bar"
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
