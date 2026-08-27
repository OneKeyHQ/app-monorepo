import {
  closeWcPayDialog,
  getWcPayDialogState,
  hideWcPayDialog,
  openWcPayDialog,
  revealWcPayDialog,
  subscribeWcPayDialog,
} from '../wcPayDialogStore';

describe('wcPayDialogStore', () => {
  beforeEach(() => {
    closeWcPayDialog();
  });

  it('opens with a payment link and a fresh instance id', () => {
    openWcPayDialog({ paymentLink: 'https://pay.walletconnect.com/pay_1' });
    const state = getWcPayDialogState();
    expect(state.isOpen).toBe(true);
    expect(state.isHidden).toBe(false);
    expect(state.paymentLink).toBe('https://pay.walletconnect.com/pay_1');
    expect(state.instanceId).toBeTruthy();
  });

  it('re-opening replaces the link and bumps the instance id (fresh flow)', () => {
    openWcPayDialog({ paymentLink: 'link-a' });
    const first = getWcPayDialogState().instanceId;
    openWcPayDialog({ paymentLink: 'link-b' });
    const state = getWcPayDialogState();
    expect(state.paymentLink).toBe('link-b');
    expect(state.instanceId).not.toBe(first);
    expect(state.isHidden).toBe(false);
  });

  it('hide/reveal toggles visibility without ending the flow', () => {
    openWcPayDialog({ paymentLink: 'link' });
    const id = getWcPayDialogState().instanceId;
    hideWcPayDialog();
    expect(getWcPayDialogState()).toMatchObject({
      isOpen: true,
      isHidden: true,
    });
    revealWcPayDialog();
    expect(getWcPayDialogState()).toMatchObject({
      isOpen: true,
      isHidden: false,
    });
    expect(getWcPayDialogState().instanceId).toBe(id);
  });

  it('close resets everything', () => {
    openWcPayDialog({ paymentLink: 'link' });
    hideWcPayDialog();
    closeWcPayDialog();
    expect(getWcPayDialogState()).toMatchObject({
      isOpen: false,
      isHidden: false,
      paymentLink: '',
    });
  });

  it('notifies subscribers on every transition and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeWcPayDialog(listener);
    openWcPayDialog({ paymentLink: 'link' });
    hideWcPayDialog();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    closeWcPayDialog();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('hide/reveal on a closed store is a no-op', () => {
    hideWcPayDialog();
    expect(getWcPayDialogState().isHidden).toBe(false);
    revealWcPayDialog();
    expect(getWcPayDialogState().isHidden).toBe(false);
  });
});
