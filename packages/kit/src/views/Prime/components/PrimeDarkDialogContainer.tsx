import { forwardRef } from 'react';

import type {
  IDialogContainerProps,
  IDialogInstance,
} from '@onekeyhq/components';
import { DialogContainer, Theme } from '@onekeyhq/components';

export const PrimeDarkDialogContainer = forwardRef<
  IDialogInstance,
  IDialogContainerProps
>(function PrimeDarkDialogContainer(props, ref) {
  return (
    <Theme name="dark">
      <DialogContainer ref={ref} {...props} />
    </Theme>
  );
});
