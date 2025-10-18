import { useCallback } from 'react';

import { SizableText, Stack } from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export interface IFooterLinkProps {
  label: string;
  href: string;
}

export function FooterLink({ label, href }: IFooterLinkProps) {
  const handlePress = useCallback(() => {
    openUrlExternal(href);
  }, [href]);

  return (
    <Stack role="link" onPress={handlePress} cursor="pointer">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
    </Stack>
  );
}

