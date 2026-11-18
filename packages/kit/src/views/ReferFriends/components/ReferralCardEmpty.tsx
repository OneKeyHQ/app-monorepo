import type { ComponentProps } from 'react';

import { Empty } from '@onekeyhq/components';

// The referral pages' quiet in-card empty state: the handshake illustration,
// short copy and an optional action, inside the caller's card style.
export function ReferralCardEmpty(
  props: Omit<
    ComponentProps<typeof Empty>,
    'illustration' | 'illustrationProps' | 'descriptionProps'
  >,
) {
  return (
    <Empty
      py="$10"
      illustration="ShakeHands"
      illustrationProps={{ size: 80, mb: '$1' }}
      descriptionProps={{ size: '$bodyMd' }}
      {...props}
    />
  );
}
