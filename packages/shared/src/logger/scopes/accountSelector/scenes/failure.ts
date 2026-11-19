import { BaseScene } from '../../../base/baseScene';
import { LogToLocal } from '../../../base/decorators';
import { redactErrorMessageForLocalLog } from '../../../utils/redactErrorMessage';

// Failures a user can notice, kept out of the dev-only scenes on purpose.
// These are the cases where the app stops doing something the user asked for
// and cannot recover on its own, so a support report needs them in the exported
// log. Payloads carry no account identifiers.
export class AccountSelectorFailureScene extends BaseScene {
  @LogToLocal({ level: 'warn' })
  public activationFailed({
    connectionKind,
    errorMessage,
    errorName,
    num,
    phase,
    sceneName,
  }: {
    // walletConnect / evmEIP6963 / evmInjected. The failure modes have nothing
    // in common: a relay timeout, a provider that never announced itself, and a
    // missing window global are three different investigations.
    connectionKind: string;
    errorMessage: string | undefined;
    errorName: string | undefined;
    num: number;
    // Which step threw: connector activation or the peer-wallet sync that
    // follows it. They fail for different reasons and need different fixes.
    phase: string;
    sceneName: string | undefined;
  }) {
    return [
      'accountSelector external account activation failed',
      {
        connectionKind,
        errorMessage: redactErrorMessageForLocalLog(errorMessage),
        errorName,
        num,
        phase,
        sceneName,
      },
    ];
  }

  // The connector was activated but the peer wallet sync never ran, and nothing
  // will retry it: the effect only re-runs when the external account id or
  // network id changes, and neither did. Cancellation from an unmount or a
  // dependency change is deliberately not logged here — that path re-runs on
  // its own and would drown this one out on every account switch.
  @LogToLocal({ level: 'warn' })
  public peerSyncSkipped({
    connectionKind,
    num,
    reason,
    sceneName,
  }: {
    connectionKind: string;
    num: number;
    // Which half of the active account moved out from under the sync while it
    // waited: the account or the network. They point at different owners.
    reason: string;
    sceneName: string | undefined;
  }) {
    return [
      'accountSelector external peer wallet sync skipped',
      { connectionKind, num, reason, sceneName },
    ];
  }

  // One entry per selection that visibly did nothing, carrying both halves of
  // the answer: `outcome` is which check rejected it, `entry` is which UI asked.
  // Reading a support log should not require correlating two separate lines.
  //   stale* .............. superseded by a newer selection; expected during
  //                         fast switching, and the user sees their newer pick
  //   unavailable-wallet .. the wallet is gone or a mock; nothing will happen
  //   wallet-check-error .. the wallet lookup itself threw
  @LogToLocal({ level: 'warn' })
  public accountSelectRejected({
    entry,
    num,
    outcome,
    reason,
    sceneName,
    walletKind,
  }: {
    entry: string;
    num: number;
    outcome: string;
    reason: string | undefined;
    sceneName: string | undefined;
    // hd / hw / qr / imported / watching / external. An unavailable hardware
    // wallet usually means a disconnected device, an unavailable hd wallet
    // means missing data — same outcome, different investigation.
    walletKind: string;
  }) {
    return [
      'accountSelector account selection rejected',
      { entry, num, outcome, reason, sceneName, walletKind },
    ];
  }

  // The active-account reload failed and the selector keeps whatever it had —
  // or, for the build phase, an empty account already marked ready. Edge
  // triggered via takeActiveReloadFailureLogSlot: one entry per failing run,
  // not per retry, because the reload re-fires on every AccountUpdate while the
  // background runtime is down.
  //   transfer-gate ......... the pre-reload transfer/backup check threw
  //   reload-action ......... the reload action itself threw
  //   build-active-account .. bg could not build the active account, and the
  //                           selector fell back to an empty one with ready:true
  @LogToLocal({ level: 'warn' })
  public activeReloadFailed({
    consecutiveFailures,
    errorMessage,
    errorName,
    num,
    phase,
    previousFailures,
    sceneName,
  }: {
    // Always 1 on the entry that opens a failing run; the real total arrives on
    // the matching activeReloadRecovered.
    consecutiveFailures: number;
    errorMessage: string | undefined;
    errorName: string | undefined;
    num: number;
    phase: string;
    // Failures accumulated under the previous cause when the cause changed
    // mid-run, so no suppressed count is lost.
    previousFailures: number | undefined;
    sceneName: string | undefined;
  }) {
    return [
      'accountSelector active account reload failed',
      {
        consecutiveFailures,
        errorMessage: redactErrorMessageForLocalLog(errorMessage),
        errorName,
        num,
        phase,
        previousFailures,
        sceneName,
      },
    ];
  }

  // Closes a failing run reported by activeReloadFailed, carrying the retries
  // that were suppressed in between. No entry for a phase that failed means the
  // reload never succeeded again — see activeReloadFailureLog.ts.
  @LogToLocal({ level: 'warn' })
  public activeReloadRecovered({
    failuresBeforeRecovery,
    num,
    phase,
    sceneName,
  }: {
    failuresBeforeRecovery: number;
    num: number;
    phase: string;
    sceneName: string | undefined;
  }) {
    return [
      'accountSelector active account reload recovered',
      { failuresBeforeRecovery, num, phase, sceneName },
    ];
  }

  // A single stage of the background active-account build threw and the build
  // continued with a degraded result (missing wallet, account, network, or
  // derive info) instead of failing outright. Deliberately not gated by the
  // perf nonce: dapp-triggered builds never pass one, and these partial
  // failures are the only bg-side trace for "my account looks empty after
  // switching network". Payload stays deterministic for a given failure so the
  // transport can collapse byte-identical consecutive entries.
  @LogToLocal({ level: 'warn' })
  public buildActiveAccountStageFailed({
    errorMessage,
    errorName,
    networkId,
    stage,
  }: {
    errorMessage: string | undefined;
    errorName: string | undefined;
    // Network id is chain topology, not an account identifier, and which chain
    // was being resolved is usually the answer to why a stage failed.
    networkId: string | undefined;
    stage: string;
  }) {
    return [
      'accountSelector build active account stage failed',
      {
        errorMessage: redactErrorMessageForLocalLog(errorMessage),
        errorName,
        networkId,
        stage,
      },
    ];
  }

  // Marking stale hardware wallets deprecated failed after the device pairing
  // itself already succeeded. Best-effort by design — the success path must
  // never fail on it — but a stale wallet left visible sends the user into a
  // dead wallet entry, so the exported log needs the failure.
  @LogToLocal({ level: 'warn' })
  public hwWalletDeprecatedStatusUpdateFailed({
    errorMessage,
    errorName,
    walletType,
  }: {
    errorMessage: string | undefined;
    errorName: string | undefined;
    // onekey-hardware / trezor: two dedup flows that share only this outcome.
    walletType: string;
  }) {
    return [
      'accountSelector hw wallet deprecated status update failed',
      {
        errorMessage: redactErrorMessageForLocalLog(errorMessage),
        errorName,
        walletType,
      },
    ];
  }

  // The selection never reached storage, so the next cold start restores the
  // previous account and the user's switch silently reverts. Retried only when
  // the selection changes again — standing still keeps the loss.
  @LogToLocal({ level: 'warn' })
  public selectionSaveFailed({
    consecutiveFailures,
    errorMessage,
    errorName,
    num,
    previousFailures,
    sceneName,
  }: {
    consecutiveFailures: number;
    errorMessage: string | undefined;
    errorName: string | undefined;
    num: number;
    previousFailures: number | undefined;
    sceneName: string | undefined;
  }) {
    return [
      'accountSelector selection save failed',
      {
        consecutiveFailures,
        errorMessage: redactErrorMessageForLocalLog(errorMessage),
        errorName,
        num,
        previousFailures,
        sceneName,
      },
    ];
  }

  // Closes a run reported by selectionSaveFailed. Only a save that actually ran
  // counts: the skip paths (unchanged revision, default selection) leave an open
  // run alone rather than claiming a recovery that never happened.
  @LogToLocal({ level: 'warn' })
  public selectionSaveRecovered({
    failuresBeforeRecovery,
    num,
    sceneName,
  }: {
    failuresBeforeRecovery: number;
    num: number;
    sceneName: string | undefined;
  }) {
    return [
      'accountSelector selection save recovered',
      { failuresBeforeRecovery, num, sceneName },
    ];
  }
}
