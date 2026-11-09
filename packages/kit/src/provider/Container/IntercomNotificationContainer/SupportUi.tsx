import { useEffect } from 'react';

import { rootNavigationRef } from '@onekeyhq/components';
import { registerIntercomSupportUi } from '@onekeyhq/shared/src/modules3rdParty/intercom/supportUi';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';

export function SupportUi() {
  useEffect(
    () =>
      registerIntercomSupportUi((params) => {
        const navigation = rootNavigationRef.current;
        if (!navigation?.isReady()) return false;
        navigation.navigate({
          name: ERootRoutes.Modal,
          params: {
            screen: EModalRoutes.IntercomModal,
            params: {
              screen: params.conversationId
                ? EIntercomRoutes.Conversation
                : EIntercomRoutes.Home,
              params: { ...params, userId: params.userId ?? '' },
            },
          },
          pop: true,
        });
        return true;
      }),
    [],
  );
  return null;
}
