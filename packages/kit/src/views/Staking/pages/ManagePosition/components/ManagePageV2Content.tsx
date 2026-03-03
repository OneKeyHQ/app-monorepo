import type { ComponentProps } from 'react';

import { NormalManageContent } from './NormalManageContent';

type INormalManageContentProps = ComponentProps<typeof NormalManageContent>;

export function ManagePageV2Content(props: INormalManageContentProps) {
  return <NormalManageContent {...props} preferManagePageActionText />;
}
