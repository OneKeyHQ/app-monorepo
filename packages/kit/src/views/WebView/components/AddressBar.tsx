import { memo, useCallback, useMemo } from 'react';

import { Icon, SizableText, XStack, useClipboard } from '@onekeyhq/components';

function formatDisplayUrl(url: string | undefined): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const isSecure = parsed.protocol === 'https:';
    // Strip protocol for visual cleanliness; keep host + path.
    const tail = `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}`;
    return isSecure ? tail : `${parsed.protocol}//${tail}`;
  } catch {
    return url;
  }
}

/**
 * Read-only address bar. Tap to copy current URL to clipboard.
 */
function AddressBar({ url }: { url: string | undefined }) {
  const { copyText } = useClipboard();

  const displayUrl = useMemo(() => formatDisplayUrl(url), [url]);
  const isSecure = useMemo(() => {
    if (!url) return false;
    try {
      return new URL(url).protocol === 'https:';
    } catch {
      return false;
    }
  }, [url]);

  const handlePress = useCallback(() => {
    if (url) {
      copyText(url);
    }
  }, [copyText, url]);

  if (!url) {
    return null;
  }

  return (
    <XStack
      alignItems="center"
      gap="$2"
      mx="$4"
      my="$2"
      px="$3"
      py="$1.5"
      borderRadius="$2"
      bg="$bgSubdued"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      onPress={handlePress}
      role="button"
    >
      <Icon
        name={isSecure ? 'LockOutline' : 'GlobusOutline'}
        size="$4"
        color="$iconSubdued"
      />
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        flex={1}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {displayUrl}
      </SizableText>
    </XStack>
  );
}

export default memo(AddressBar);
