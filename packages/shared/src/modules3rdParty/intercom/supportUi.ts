import type { IIntercomSupportRoute } from './messengerTypes';

type IPresenter = (route: IIntercomSupportRoute) => boolean;
let presenter: IPresenter | undefined;

// Registered by kit in the main runtime; shared never imports UI packages.
export function registerIntercomSupportUi(handler: IPresenter) {
  presenter = handler;
  return () => {
    if (presenter === handler) presenter = undefined;
  };
}

export function presentIntercomSupportUi(route: IIntercomSupportRoute) {
  return presenter?.(route);
}
