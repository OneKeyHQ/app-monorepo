import { memo } from 'react';

import { Button, XStack } from '@onekeyhq/components';
import type { ILocalizedProtocolPositionAction } from '@onekeyhq/kit/src/utils/defiPositionUtils';

const ProtocolPositionActionShell = memo(
  ({ action }: { action?: ILocalizedProtocolPositionAction }) => {
    if (!action) {
      return null;
    }

    return (
      <XStack justifyContent="flex-end">
        <Button size="small" variant="primary" pointerEvents="none">
          {action.label}
        </Button>
      </XStack>
    );
  },
);

ProtocolPositionActionShell.displayName = 'ProtocolPositionActionShell';

export { ProtocolPositionActionShell };
