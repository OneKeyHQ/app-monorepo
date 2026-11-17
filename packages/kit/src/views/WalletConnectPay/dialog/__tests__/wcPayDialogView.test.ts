import { EWcPayStatus } from '@onekeyhq/shared/src/walletConnect/payTypes';

import { deriveWcPayDialogView } from '../wcPayDialogView';

import type { IWcPayDialogViewInput } from '../wcPayDialogView';

const base: IWcPayDialogViewInput = {
  isLoading: false,
  loadError: false,
  hasPayResult: true,
  isUnsupportedAccountType: false,
  areOptionsRefusedOnPlatform: false,
  optionsCount: 2,
  payStatus: EWcPayStatus.RequiresAction,
  isExpiredLocally: false,
  hasDamagedProgress: false,
  pagePhaseName: 'idle',
  pollStatus: undefined,
  pollIsFinal: false,
  pollExhausted: false,
};

describe('deriveWcPayDialogView', () => {
  it('shows fetching while loading', () => {
    expect(
      deriveWcPayDialogView({ ...base, isLoading: true, hasPayResult: false }),
    ).toEqual({ step: { name: 'fetching' }, dismissible: true });
  });

  it('shows fetching before any result exists', () => {
    expect(deriveWcPayDialogView({ ...base, hasPayResult: false })).toEqual({
      step: { name: 'fetching' },
      dismissible: true,
    });
  });

  it('shows fetchFailed on load error', () => {
    expect(
      deriveWcPayDialogView({ ...base, loadError: true, hasPayResult: false }),
    ).toEqual({ step: { name: 'fetchFailed' }, dismissible: true });
  });

  it('shows options when payable', () => {
    expect(deriveWcPayDialogView(base)).toEqual({
      step: { name: 'options', empty: undefined },
      dismissible: true,
    });
  });

  it('flags the platform-refused empty variant', () => {
    expect(
      deriveWcPayDialogView({ ...base, areOptionsRefusedOnPlatform: true }),
    ).toEqual({
      step: { name: 'options', empty: 'platformRefused' },
      dismissible: true,
    });
  });

  it('flags the no-assets empty variant', () => {
    expect(deriveWcPayDialogView({ ...base, optionsCount: 0 })).toEqual({
      step: { name: 'options', empty: 'noAssets' },
      dismissible: true,
    });
  });

  it('shows the unsupported-account state', () => {
    expect(
      deriveWcPayDialogView({ ...base, isUnsupportedAccountType: true }),
    ).toEqual({ step: { name: 'unsupported' }, dismissible: true });
  });

  it('locks the dialog for the whole paying phase (Q9)', () => {
    expect(deriveWcPayDialogView({ ...base, pagePhaseName: 'paying' })).toEqual(
      { step: { name: 'confirming' }, dismissible: false },
    );
  });

  it('maps local expiry on the options step to the expired terminal (Q6)', () => {
    expect(deriveWcPayDialogView({ ...base, isExpiredLocally: true })).toEqual({
      step: { name: 'terminal', reason: 'expired' },
      dismissible: true,
    });
  });

  it('maps server-final statuses on the options step to terminals', () => {
    expect(
      deriveWcPayDialogView({ ...base, payStatus: EWcPayStatus.Expired }),
    ).toEqual({
      step: { name: 'terminal', reason: 'expired' },
      dismissible: true,
    });
    expect(
      deriveWcPayDialogView({ ...base, payStatus: EWcPayStatus.Cancelled }),
    ).toEqual({
      step: { name: 'terminal', reason: 'cancelled' },
      dismissible: true,
    });
    expect(
      deriveWcPayDialogView({ ...base, payStatus: EWcPayStatus.Failed }),
    ).toEqual({
      step: { name: 'terminal', reason: 'failed' },
      dismissible: true,
    });
    // an already-succeeded payment cannot be paid again; close is the only exit
    expect(
      deriveWcPayDialogView({ ...base, payStatus: EWcPayStatus.Succeeded }),
    ).toEqual({
      step: { name: 'terminal', reason: 'alreadyPaid' },
      dismissible: true,
    });
  });

  it('keeps the options step when the server status is processing-but-listed', () => {
    // Processing with options present is NOT payable (positive RequiresAction
    // gate) but also not a terminal — the options step renders with the pay
    // button disabled by the flow's own isPaymentActionable gate.
    expect(
      deriveWcPayDialogView({ ...base, payStatus: EWcPayStatus.Processing }),
    ).toEqual({
      step: { name: 'options', empty: undefined },
      dismissible: true,
    });
  });

  it('shows the damaged-progress step above the options step', () => {
    expect(
      deriveWcPayDialogView({ ...base, hasDamagedProgress: true }),
    ).toEqual({ step: { name: 'damaged' }, dismissible: true });
  });

  it('result phase: success', () => {
    expect(
      deriveWcPayDialogView({
        ...base,
        pagePhaseName: 'result',
        pollStatus: EWcPayStatus.Succeeded,
        pollIsFinal: true,
      }),
    ).toEqual({ step: { name: 'success' }, dismissible: true });
  });

  it('result phase: failed terminal', () => {
    expect(
      deriveWcPayDialogView({
        ...base,
        pagePhaseName: 'result',
        pollStatus: EWcPayStatus.Failed,
        pollIsFinal: true,
      }),
    ).toEqual({
      step: { name: 'terminal', reason: 'failed' },
      dismissible: true,
    });
  });

  it('result phase: expired and cancelled terminals', () => {
    expect(
      deriveWcPayDialogView({
        ...base,
        pagePhaseName: 'result',
        pollStatus: EWcPayStatus.Expired,
        pollIsFinal: true,
      }),
    ).toEqual({
      step: { name: 'terminal', reason: 'expired' },
      dismissible: true,
    });
    expect(
      deriveWcPayDialogView({
        ...base,
        pagePhaseName: 'result',
        pollStatus: EWcPayStatus.Cancelled,
        pollIsFinal: true,
      }),
    ).toEqual({
      step: { name: 'terminal', reason: 'cancelled' },
      dismissible: true,
    });
  });

  it('result phase: processing stays locked until final or exhausted', () => {
    expect(
      deriveWcPayDialogView({
        ...base,
        pagePhaseName: 'result',
        pollStatus: EWcPayStatus.Processing,
      }),
    ).toEqual({
      step: { name: 'submitted', canClose: false },
      dismissible: false,
    });
    expect(
      deriveWcPayDialogView({
        ...base,
        pagePhaseName: 'result',
        pollStatus: EWcPayStatus.Processing,
        pollExhausted: true,
      }),
    ).toEqual({
      step: { name: 'submitted', canClose: true },
      dismissible: true,
    });
  });

  it('result phase wins over everything else', () => {
    expect(
      deriveWcPayDialogView({
        ...base,
        pagePhaseName: 'result',
        pollStatus: EWcPayStatus.Succeeded,
        pollIsFinal: true,
        hasDamagedProgress: true,
        isExpiredLocally: true,
        loadError: true,
      }),
    ).toEqual({ step: { name: 'success' }, dismissible: true });
  });

  it('paying lock wins over content states but not over result', () => {
    expect(
      deriveWcPayDialogView({
        ...base,
        pagePhaseName: 'paying',
        isExpiredLocally: true,
        optionsCount: 0,
      }),
    ).toEqual({ step: { name: 'confirming' }, dismissible: false });
  });
});
