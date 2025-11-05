import { useCallback } from 'react';

import { Button, useClipboard } from '@onekeyhq/components';

export function CopyLinkButton({ url }: { url: string }) {
  const { copyText } = useClipboard();

  const handleCopy = useCallback(() => {
    void copyText(url);
  }, [url, copyText]);

  return (
    <Button variant="secondary" size="small" onPress={handleCopy}>
      Copy link
    </Button>
  );
}
