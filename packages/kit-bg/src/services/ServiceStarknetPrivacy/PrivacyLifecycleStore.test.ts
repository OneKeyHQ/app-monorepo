import {
  EStrk20AccountPhase,
  EStrk20OptInStatus,
  EStrk20SequencingStatus,
  EStrk20TxGateStatus,
  type IStrk20AccountPrivacyState,
  type IStrk20SequencingState,
} from '@onekeyhq/shared/types/starknetPrivacy';

import { deriveAccountPrivacySnapshot } from './PrivacyLifecycleStore';

const BASE_STATE: IStrk20AccountPrivacyState = {
  profileId: 'account-leaf-v1',
  version: 1,
  networkId: 'starknet--mainnet',
  accountId: 'hd-1--m/44/9004/0/0/0',
  chainId: '0x534e5f4d41494e',
  accountAddress: '0x1234',
  poolAddress: '0xpool',
  keyIndex: 0,
  accountKeyScheme: 'stark-curve',
  accountKeyFingerprint: 'fp',
  optInStatus: EStrk20OptInStatus.None,
};

const READY_SEQUENCING: IStrk20SequencingState = {
  status: EStrk20SequencingStatus.Ready,
  latestBlock: 1000,
  blocksRemaining: 0,
  estimatedSecondsRemaining: 0,
  provingBlockId: 991,
};

describe('deriveAccountPrivacySnapshot (explicit dual state machine)', () => {
  it('returns unavailable when privacy is disabled or state is absent', () => {
    expect(
      deriveAccountPrivacySnapshot({
        available: false,
        state: BASE_STATE,
        sequencing: READY_SEQUENCING,
        isKeyLoaded: true,
        isSubmitting: false,
      }),
    ).toMatchObject({
      phase: EStrk20AccountPhase.Unavailable,
      txGate: { status: EStrk20TxGateStatus.Idle },
      hasConsented: false,
    });
  });

  it.each([
    {
      name: 'activation_required when deployment is required and no activation tx is pending',
      state: { ...BASE_STATE, optInStatus: EStrk20OptInStatus.None },
      sequencing: {
        ...READY_SEQUENCING,
        status: EStrk20SequencingStatus.ActivationRequired,
      },
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.ActivationRequired,
    },
    {
      name: 'activating when activationTxid is recorded',
      state: {
        ...BASE_STATE,
        optInStatus: EStrk20OptInStatus.None,
        activationTxid: '0xact',
      },
      sequencing: {
        ...READY_SEQUENCING,
        status: EStrk20SequencingStatus.Waiting,
        blocksRemaining: 10,
      },
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.Activating,
    },
    {
      name: 'not_opted_in when deployed and not yet registered',
      state: { ...BASE_STATE, optInStatus: EStrk20OptInStatus.Consented },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.NotOptedIn,
    },
    {
      name: 'registering when register tx is pending',
      state: {
        ...BASE_STATE,
        optInStatus: EStrk20OptInStatus.RegisterPending,
        registerTxid: '0xreg',
      },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.Registering,
    },
    {
      name: 'key_locked when registered on-chain but viewing key is not loaded',
      state: { ...BASE_STATE, optInStatus: EStrk20OptInStatus.Registered },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: false,
      expectedPhase: EStrk20AccountPhase.KeyLocked,
    },
    {
      name: 'ready when registered and viewing key is loaded in memory',
      state: { ...BASE_STATE, optInStatus: EStrk20OptInStatus.Registered },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: true,
      expectedPhase: EStrk20AccountPhase.Ready,
    },
    {
      name: 'key_mismatch takes terminal precedence over everything else',
      state: {
        ...BASE_STATE,
        optInStatus: EStrk20OptInStatus.Mismatch,
        activationTxid: '0xact',
      },
      sequencing: READY_SEQUENCING,
      isKeyLoaded: true,
      expectedPhase: EStrk20AccountPhase.KeyMismatch,
    },
  ])('derives $name', ({ state, sequencing, isKeyLoaded, expectedPhase }) => {
    const snapshot = deriveAccountPrivacySnapshot({
      available: true,
      state,
      sequencing,
      isKeyLoaded,
      isSubmitting: false,
    });
    expect(snapshot.phase).toBe(expectedPhase);
  });

  it('derives orthogonal txGate transitions (submitting > pending_tx > cooldown > idle)', () => {
    const registeredState: IStrk20AccountPrivacyState = {
      ...BASE_STATE,
      optInStatus: EStrk20OptInStatus.Registered,
    };

    expect(
      deriveAccountPrivacySnapshot({
        available: true,
        state: registeredState,
        sequencing: READY_SEQUENCING,
        isKeyLoaded: true,
        isSubmitting: true,
      }).txGate.status,
    ).toBe(EStrk20TxGateStatus.Submitting);

    const pendingTransfer = {
      txid: '0xtx1',
      kind: 'transfer' as const,
      status: 'pending' as const,
      submittedAt: 1000,
    };
    const pendingSnap = deriveAccountPrivacySnapshot({
      available: true,
      state: { ...registeredState, lastTransfer: pendingTransfer },
      sequencing: {
        ...READY_SEQUENCING,
        status: EStrk20SequencingStatus.Waiting,
        blocksRemaining: 10,
      },
      isKeyLoaded: true,
      isSubmitting: false,
    });
    expect(pendingSnap.txGate.status).toBe(EStrk20TxGateStatus.PendingTx);
    expect(pendingSnap.txGate.pendingTx).toEqual(pendingTransfer);

    const cooldownSnap = deriveAccountPrivacySnapshot({
      available: true,
      state: registeredState,
      sequencing: {
        ...READY_SEQUENCING,
        status: EStrk20SequencingStatus.Waiting,
        blocksRemaining: 4,
        estimatedSecondsRemaining: 8,
      },
      isKeyLoaded: true,
      isSubmitting: false,
    });
    expect(cooldownSnap.txGate).toMatchObject({
      status: EStrk20TxGateStatus.Cooldown,
      blocksRemaining: 4,
      estimatedSecondsRemaining: 8,
    });

    expect(
      deriveAccountPrivacySnapshot({
        available: true,
        state: registeredState,
        sequencing: READY_SEQUENCING,
        isKeyLoaded: true,
        isSubmitting: false,
      }).txGate,
    ).toMatchObject({
      status: EStrk20TxGateStatus.Idle,
      provingBlockId: 991,
    });
  });
});
