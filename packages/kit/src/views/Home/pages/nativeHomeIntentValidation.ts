import type {
  INativeHomeIntent,
  INativeHomeViewModel,
} from '@onekeyhq/native-components';

export function isNativeHomeIntentExecutable({
  intent,
  viewModel,
}: {
  intent: INativeHomeIntent;
  viewModel: INativeHomeViewModel | null;
}): boolean {
  if (
    !viewModel ||
    intent.owner.scopeKey !== viewModel.owner.scopeKey ||
    intent.owner.sessionId !== viewModel.owner.sessionId
  ) {
    return false;
  }

  if (intent.actionId === viewModel.header.balanceActionId) {
    return viewModel.header.balanceActionEnabled;
  }

  return viewModel.header.actions.some(
    (action) => action.id === intent.actionId && action.enabled,
  );
}
