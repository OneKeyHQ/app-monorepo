import { forwardRef } from 'react';

import type {
  IDialogContainerProps,
  IDialogInstance,
} from '@onekeyhq/components';
import { DialogContainer, Theme } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const PrimeDarkDialogContainer = forwardRef<
  IDialogInstance,
  IDialogContainerProps
>(function PrimeDarkDialogContainer(props, ref) {
  // The web portal loses the outer Theme's DOM ancestor. Put its theme class
  // on the measured card itself; a wrapper would change the animation origin.
  const floatingPanelProps = platformEnv.isNative
    ? props.floatingPanelProps
    : {
        ...props.floatingPanelProps,
        className: ['t_dark', props.floatingPanelProps?.className]
          .filter(Boolean)
          .join(' '),
      };
  return (
    <Theme name="dark">
      <DialogContainer
        ref={ref}
        {...props}
        floatingPanelProps={floatingPanelProps}
      />
    </Theme>
  );
});
