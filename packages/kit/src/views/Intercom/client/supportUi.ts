import { StackActions } from '@react-navigation/native';

import { rootNavigationRef } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes, ERootRoutes } from '@onekeyhq/shared/src/routes';
import { EIntercomRoutes } from '@onekeyhq/shared/src/routes/intercom';
import type { IIntercomSupportRoute } from '@onekeyhq/shared/src/routes/intercom';

export function presentIntercomSupportUi(
  params: IIntercomSupportRoute,
  { hasUnread = false }: { hasUnread?: boolean } = {},
) {
  const navigation = rootNavigationRef.current;
  if (!navigation?.isReady()) return false;
  // A targeted conversation wins; otherwise unread replies open the message
  // list directly instead of the support home.
  let screen = EIntercomRoutes.Home;
  let selectedBranch: 'rn-conversation' | 'rn-messages' | 'rn-home' = 'rn-home';
  if (params.conversationId) {
    screen = EIntercomRoutes.Conversation;
    selectedBranch = 'rn-conversation';
  } else if (hasUnread) {
    screen = EIntercomRoutes.Messages;
    selectedBranch = 'rn-messages';
  }
  const modalParams = {
    screen: EModalRoutes.IntercomModal,
    params: { screen, params },
  };
  const state = navigation.getRootState();
  const current = state.routes[state.index];
  const currentModal = current?.state;
  // A partial (rehydrated) stack state without an index focuses its last route.
  const focusedModal =
    currentModal?.routes[currentModal.index ?? currentModal.routes.length - 1];
  const isSupportOpen =
    current?.name === ERootRoutes.Modal &&
    (focusedModal?.name === EModalRoutes.IntercomModal ||
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
    selectedBranch,
  });
  return true;
}
