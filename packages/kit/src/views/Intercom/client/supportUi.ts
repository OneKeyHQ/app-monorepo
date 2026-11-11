import { StackActions } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';
import type { IIntercomSupportRoute } from '@onekeyhq/shared/src/routes/intercom';

export function presentIntercomSupportUi(params: IIntercomSupportRoute) {
  const navigation = rootNavigationRef.current;
  if (!navigation?.isReady()) return false;
  const modalParams = {
    screen: EModalRoutes.IntercomModal,
    params: {
      screen: params.conversationId
        ? EIntercomRoutes.Conversation
        : EIntercomRoutes.Home,
      params,
    },
  };
  const state = navigation.getRootState();
  const current = state.routes[state.index];
  const currentModal = current?.state;
  const isSupportOpen =
    current?.name === ERootRoutes.Modal &&
    (currentModal?.routes[currentModal.index ?? 0]?.name ===
      EModalRoutes.IntercomModal ||
      (current.params &&
        'screen' in current.params &&
        current.params.screen === EModalRoutes.IntercomModal));
  if (isSupportOpen) {
    navigation.navigate({
      name: ERootRoutes.Modal,
      params: modalParams,
      pop: true,
    });
  } else {
    // Keep the caller's modal (including a mandatory update) underneath
    // support so closing the conversation cannot dismiss its guard.
    navigation.dispatch({
      ...StackActions.push(ERootRoutes.Modal, modalParams),
      target: state.key,
    });
  }
  defaultLogger.notification.support.supportReplyBranch({
    conversationId: params.conversationId,
    selectedBranch: params.conversationId ? 'rn-conversation' : 'rn-home',
  });
  return true;
}
