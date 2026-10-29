import { EModalBulkSendRoutes } from '@onekeyhq/shared/src/routes/bulkSend';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EModalSendRoutes } from '@onekeyhq/shared/src/routes/send';

import {
  type IIntercomNavigationState,
  shouldShowIntercomInAppMessages,
} from './visibility';

const main: IIntercomNavigationState = {
  type: 'stack',
  index: 0,
  routes: [{ name: 'Main' }],
};

describe('Intercom in-app notification scenes', () => {
  it('requires an unlocked app and a ready navigation state', () => {
    expect(shouldShowIntercomInAppMessages(false, undefined)).toBe(false);
    expect(shouldShowIntercomInAppMessages(false, { routes: [] })).toBe(false);
    expect(shouldShowIntercomInAppMessages(true, main)).toBe(false);
    expect(shouldShowIntercomInAppMessages(false, main)).toBe(true);
  });

  it.each([
    EModalRoutes.SignatureConfirmModal,
    EModalRoutes.SignAndVerifyModal,
    EModalSendRoutes.SendConfirm,
    EModalSendRoutes.SendConfirmFromDApp,
    EModalSendRoutes.SendConfirmFromSwap,
    EModalBulkSendRoutes.BulkSendReview,
    EModalBulkSendRoutes.BulkSendProcess,
  ])(
    'keeps %s quiet under another overlay until its stack is removed',
    (name) => {
      const state = {
        type: 'stack',
        index: 2,
        routes: [{ name: 'Main' }, { name }, { name: 'FeeDetails' }],
      };
      expect(shouldShowIntercomInAppMessages(false, state)).toBe(false);
      expect(
        shouldShowIntercomInAppMessages(false, { ...state, index: 0 }),
      ).toBe(true);
    },
  );

  it('does not let an inactive tab block ordinary browsing', () => {
    const state: IIntercomNavigationState = {
      type: 'tab',
      index: 0,
      routes: [
        { name: 'Home', state: main },
        {
          name: 'Swap',
          state: {
            type: 'stack',
            routes: [{ name: EModalRoutes.SignatureConfirmModal }],
          },
        },
      ],
    };
    expect(shouldShowIntercomInAppMessages(false, state)).toBe(true);
    expect(shouldShowIntercomInAppMessages(false, { ...state, index: 1 })).toBe(
      false,
    );
  });

  it('allows ordinary input pages but blocks their nested legacy confirmation', () => {
    const inputState: IIntercomNavigationState = {
      type: 'stack',
      routes: [
        {
          name: EModalRoutes.SendModal,
          state: { routes: [{ name: EModalSendRoutes.SendDataInput }] },
        },
      ],
    };
    expect(shouldShowIntercomInAppMessages(false, inputState)).toBe(true);
    const confirmationState: IIntercomNavigationState = {
      type: 'stack',
      routes: [
        {
          name: EModalRoutes.SendModal,
          state: { routes: [{ name: EModalSendRoutes.SendConfirm }] },
        },
      ],
    };
    expect(shouldShowIntercomInAppMessages(false, confirmationState)).toBe(
      false,
    );
  });
});
