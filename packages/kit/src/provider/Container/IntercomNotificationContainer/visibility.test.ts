import { ERootRoutes } from '@onekeyhq/shared/src/routes/root';

import {
  type IIntercomNavigationState,
  shouldShowIntercomInAppMessages,
} from './visibility';

describe('Intercom in-app notification scenes', () => {
  it('requires a ready navigation state', () => {
    expect(shouldShowIntercomInAppMessages(undefined)).toBe(false);
    expect(shouldShowIntercomInAppMessages({ routes: [] })).toBe(false);
  });

  it('allows messages only while the main tabs are focused', () => {
    expect(
      shouldShowIntercomInAppMessages({
        index: 0,
        routes: [{ name: ERootRoutes.Main }],
      }),
    ).toBe(true);
    expect(
      shouldShowIntercomInAppMessages({ routes: [{ name: ERootRoutes.Main }] }),
    ).toBe(true);
  });

  it.each([
    ERootRoutes.Modal,
    ERootRoutes.Onboarding,
    ERootRoutes.iOSFullScreen,
    ERootRoutes.FullScreenPush,
    ERootRoutes.WebView,
  ])('keeps %s quiet until the main tabs are focused again', (name) => {
    const state: IIntercomNavigationState = {
      index: 1,
      routes: [{ name: ERootRoutes.Main }, { name }],
    };
    expect(shouldShowIntercomInAppMessages(state)).toBe(false);
    expect(shouldShowIntercomInAppMessages({ ...state, index: 0 })).toBe(true);
  });
});
