import { useEffect, useState } from 'react';

import type { BRC20TextProps } from '@onekeyhq/engine/src/managers/nft';
import { parseBRC20Content } from '@onekeyhq/shared/src/utils/tokenUtils';

function useBRC20Content({
  content,
  contentType,
  contentUrl,
}: {
  content: string | null;
  contentType: string;
  contentUrl?: string;
}) {
  const [isBRC20Content, setIsBRC20Content] = useState(false);
  const [brc20Content, setBRC20Content] = useState<BRC20TextProps | null>(null);

  useEffect(() => {
    const parseContent = async () => {
      const { isBRC20Content: isBRC20Content1, brc20Content: brc20Content1 } =
        await parseBRC20Content({
          content,
          contentType,
          contentUrl,
        });

      setIsBRC20Content(isBRC20Content1);
      setBRC20Content(brc20Content1);
    };

    parseContent();
  }, [content, contentType, contentUrl]);

  return {
    isBRC20Content,
    brc20Content,
  };
}

export { useBRC20Content };
