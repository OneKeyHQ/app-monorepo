/* cspell:ignore Infini */
import { closePrimeInfiniPaymentOverlaysAndNavigate } from './primeInfiniPaymentNavigation';

describe('closePrimeInfiniPaymentOverlaysAndNavigate', () => {
  it('closes dialogs and modals before navigating to onboarding', async () => {
    const steps: string[] = [];

    await closePrimeInfiniPaymentOverlaysAndNavigate({
      closeDialogs: async () => {
        steps.push('dialogs');
      },
      closeModals: async () => {
        steps.push('modals');
      },
      navigate: () => {
        steps.push('navigate');
      },
    });

    expect(steps).toEqual(['dialogs', 'modals', 'navigate']);
  });
});
