import type { ComponentProps, FC } from 'react';

import { HStack, Icon, Text } from '@onekeyhq/components';

const isSecureProtocol = (url: string) =>
  ['https', 'wss'].some((p) => url.startsWith(p));

export const SiteSection: FC<
  {
    url?: string;
  } & ComponentProps<typeof HStack>
> = ({ url, ...props }) =>
  url ? (
    <HStack alignItems="center" justifyContent="center" flex="1" {...props}>
      {isSecureProtocol(url) ? <Icon name="LockClosedMini" size={12} /> : null}
      <Text
        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
        ml="1"
        numberOfLines={1}
        isTruncated
      >
        {url}
      </Text>
    </HStack>
  ) : null;
