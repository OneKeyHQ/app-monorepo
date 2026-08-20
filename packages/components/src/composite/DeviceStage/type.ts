import type { IHardwareDeviceType } from '../../content/HardwareDevice';

/**
 * Exploration-only hardware-interaction stage. Deliberately minimal, like the
 * DialogV2 it wraps: enough surface to judge the look and the step-to-step
 * feel, nothing else. Event wiring, honest cancel semantics and i18n belong
 * to the integration layer built after this is accepted.
 */

/**
 * Where the interaction currently stands. One dialog instance plays every
 * step of a burst; the content swaps in place so consecutive device requests
 * never close and reopen the surface — including the endings: failures and
 * completion render on the same stage instead of a toast or a second dialog.
 *
 * `off` is the step before the device responds: no scene, the replica sits
 * with its screen dark, and whichever step follows enters by waking it.
 * `pinOnApp` and `passphraseOnApp` are the app-side inputs — the person
 * types here while the device waits, so the replica leaves the stage and
 * the input panel takes its place. `passphraseIntro` is the teach-first
 * beat before a hidden wallet is created: what a passphrase is and the
 * facts to hold before one exists to lose, with Continue as its single
 * action — reading material, so the replica stays off stage there too;
 * drivers route through it only when creating, never for plain entry.
 * `showQr` and `scanQr` are the air-gap
 * pair — the app presents a code for the device to scan, then the app's
 * camera scans the code the device shows back; the person is holding the
 * device in both, so the replica stays off stage there too. `processing`
 * is the wait after an input round-trips: nothing is asked of the person,
 * so the stage empties to one spinner line and the sheet closes down to a
 * short strip until the device answers.
 * `error` is the terminal failure beat, worded by `errorReason`, with one
 * recovery action. `success` is the landing beat — under a second, closed
 * by the driver — and it holds the arrangement it arrives in rather than
 * moving the stage.
 */
export type IDeviceStageStep =
  | 'off'
  | 'connecting'
  | 'enterPin'
  | 'pinOnApp'
  | 'passphraseIntro'
  | 'enterPassphrase'
  | 'passphraseOnApp'
  | 'showQr'
  | 'scanQr'
  | 'confirm'
  | 'processing'
  | 'error'
  | 'success';

/**
 * What went wrong, in stage vocabulary. Each reason picks the failure copy
 * and the label of the single recovery action; the mapping from concrete
 * SDK errors onto these four is the integration layer's.
 */
export type IDeviceStageErrorReason =
  | 'rejected'
  | 'pinInvalid'
  | 'disconnected'
  | 'busy';

export interface IDeviceStageProps {
  /** Controlled visibility, passed straight through to the dialog. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Model on stage. Models without a replica render an empty stage. */
  deviceType: IHardwareDeviceType;
  step: IDeviceStageStep;
  /**
   * One line of operation context under the confirm title — what the person
   * is about to approve, e.g. "Send 0.1 ETH". The current toast shows
   * nothing, which is the gap this line exists to close.
   */
  confirmContext?: string;
  /**
   * Rows of the payload being approved — label over value, one card. It
   * fades in once the compact confirm arrangement lands: the on-screen
   * copy of what must be verified against the device. `highlightEnds`
   * gives a value the receive page's address grammar (mono, grouped by
   * four, first and last six characters highlighted).
   */
  confirmDetails?: Array<{
    label: string;
    value: string;
    highlightEnds?: boolean;
  }>;
  /**
   * Payload of the code the showQr step presents for the device to scan.
   * Multi-part rotation for large payloads belongs to the integration
   * layer, inside the same step.
   */
  qrValue?: string;
  /**
   * Advances showQr toward scanning the device's answer — the manual
   * handoff an air-gapped flow cannot make on its own: nothing tells the
   * app when the device has finished, so only the person, watching the
   * device show its code, can move forward. Omitted (a one-way broadcast
   * with nothing to scan back), the step renders no button.
   */
  onQrNext?: () => void;
  /**
   * Steps scanQr back to presenting the code — the escape hatch for a
   * premature handoff: if the device never got the task, nothing will ever
   * appear in the scan window, so the person must be able to return and
   * show the code again. Omitted, the step renders no way back.
   */
  onQrBack?: () => void;
  /** Words the error step speaks. Omitted, it falls back to a generic line. */
  errorReason?: IDeviceStageErrorReason;
  /**
   * The error step's single recovery action — retry, reconnect. Without it
   * the step renders no button and the sheet's dismissal is the only exit.
   */
  onErrorAction?: () => void;
  /** The pinOnApp entry, confirmed. The driver decides what follows. */
  onPinSubmit?: (pin: string) => void;
  /**
   * The passphraseIntro step's single action — the person has read what
   * a passphrase is and moves on; the driver decides what follows
   * (typically the create-mode entry). `keepShortcut` rides along: the
   * live dialog's wallet-list setting — whether the list keeps an
   * Add-hidden-wallet shortcut — carried out through the one exit, the
   * passphrase form's preference-upstream pattern. Omitted, the step
   * renders no button and the surface's own dismissal is the only exit.
   */
  onPassphraseIntroContinue?: (options: { keepShortcut: boolean }) => void;
  /**
   * Which shape the passphrase step takes — the live flow's two:
   * 'verify' (unlock an existing hidden wallet: the step's own title,
   * empty entry allowed — it is the standard wallet) or 'create' (the
   * Add-hidden-wallet flow: the step titles itself after it, and an
   * empty entry is refused inline). Defaults to 'verify', the plain
   * entry shape.
   */
  passphraseMode?: 'create' | 'verify';
  /**
   * The passphraseOnApp entry, confirmed. Empty is the standard wallet
   * (verify mode; create refuses it before this fires). In create mode
   * `keepAccessible` rides along — whether the new hidden wallet stays
   * after the app closes (the Keep-accessible switch). The live flow
   * treats that as a preference every exit shares, so the device switch
   * and the attach-PIN action carry the same options; in verify mode
   * they are absent everywhere.
   */
  onPassphraseSubmit?: (
    passphrase: string,
    options?: { keepAccessible: boolean },
  ) => void;
  /**
   * Shows the passphrase form's secondary "Enter Hidden Wallet PIN"
   * action (the live attach-PIN path), for devices that support it.
   * Omitted, no button renders. The wallet it opens obeys the same
   * Keep-accessible choice, hence the options (create mode only).
   */
  onPassphraseAttachPin?: (options?: { keepAccessible: boolean }) => void;
  /**
   * Moves the current app-side input onto the device instead — the switch
   * both input steps offer. From the passphrase form's create mode it
   * carries the Keep-accessible preference out, like that form's every
   * other exit; the PIN pad calls it bare.
   */
  onSwitchToDevice?: (options?: { keepAccessible: boolean }) => void;
  /**
   * One-line inline failure inside the active input panel — the
   * retry-in-place state after a refused entry, not a step change. On the
   * PIN pad its arrival also clears the typed value.
   */
  inputError?: string;
  /**
   * Blocks every dismissal path for steps that must not be interrupted
   * (a firmware install, not an everyday confirm).
   */
  locked?: boolean;
  /**
   * Passed to the dialog: keep the app behind the sheet interactive on
   * native, for drivers that steer the stage from the host screen.
   */
  backgroundInteractive?: boolean;
}
