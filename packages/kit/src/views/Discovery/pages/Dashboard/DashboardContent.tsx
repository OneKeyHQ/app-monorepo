import { useState } from 'react';

import type { IIconButtonProps } from '@onekeyhq/components';
import {
  IconButton,
  Image,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import { Banner } from './Banner';

export function DashboardContent() {
  return (
    <Stack>
      {/* Banner */}
      <Banner />
      {/* bookmarks and histories */}
    </Stack>
  );
}
