import type { IHardwareDeviceType } from '../../content/HardwareDevice';

/**
 * Exploration-only hardware-interaction stage. Deliberately minimal:
 * enough surface to judge the look and the step-to-step feel, nothing
 * else. Event wiring, honest cancel semantics and i18n belong to the
 * integration layer built after this is accepted.
 */

/**
 * Where the interaction currently stands. One stage instance plays every
 * step of a burst; the content swaps in place so consecutive device
 * requests never close and reopen the surface — including the endings:
 * failures render on the same stage instead of a toast or a second
 * dialog, and a successful burst simply returns to `off`.
 *
 * `off` is the stage at rest: the overlay is not there, and whichever
 * step follows enters at its own pose. `connecting` and `processing`
 * are the waiting beats — nothing is asked of the person, so the stage
 * rests as the floating capsule until the device answers. `pinOnApp`
 * and `passphraseOnApp` are the app-side inputs — the person types here
 * while the device waits, so the replica leaves the stage and the input
 * panel takes its place. `passphraseIntro` is the teach-first beat
 * before a hidden wallet is created: what a passphrase is and the facts
 * to hold before one exists to lose, with Continue as its single
 * action — reading material, so the replica stays off stage there too;
 * drivers route through it only when creating, never for plain entry.
 * `showQr` and `scanQr` are the air-gap pair — the app presents a code
 * for the device to scan, then the app's camera scans the code the
 * device shows back; the person is holding the device in both, so the
 * replica stays off stage there too.
 * `error` is the terminal failure beat, worded by `errorReason`, with one
 * recovery action.
 *
 * `genuineCheck`, `authVerifying`, `authSuccess` and `authFailure` are
 * the device-authenticity flow (the live Genuine check): the ask — the
 * person confirms the check on the device — then the wait while the
 * certificate (and, on capable firmware, each component hash: the
 * `authChecklist`) is verified, then a landing. The three staged steps
 * keep the replica on stage as the confirm miniature, screens per the
 * scene map; `authFailure` fronts an icon instead of the replica, worded
 * by `authFailureReason`, and its recoverable shapes gate "Continue
 * anyway" behind an in-card NOTE beat with its own Back.
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
  | 'genuineCheck'
  | 'authVerifying'
  | 'authSuccess'
  | 'authFailure'
  | 'processing'
  | 'error';

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

/**
 * What ended the authenticity check, in stage vocabulary. The first
 * three are terminal — the device (or its firmware) is the problem, and
 * Support is the only exit. The last three are recoverable — Retry plus
 * the Continue-anyway gate. Mapping concrete SDK/server errors onto
 * these is the integration layer's.
 */
export type IAuthFailureReason =
  | 'unofficialDevice'
  | 'unofficialFirmware'
  | 'defective'
  | 'network'
  | 'unknown'
  | 'unavailable';

/**
 * One row of the authenticity checklist — the per-component verification
 * the new-firmware flow plays out line by line (certificate first, then
 * each firmware hash). The driver owns the rows and their progress; the
 * stage only renders them.
 */
export interface IAuthChecklistItem {
  /** The component under check — Certificate, Firmware, Bluetooth, … */
  label: string;
  status: 'pending' | 'loading' | 'ok' | 'failed';
  /** The verified result — serial or version string — shown on ok. */
  value?: string;
  /** Release page for a verified component; the value becomes a link. */
  url?: string;
}

export interface IDeviceStageProps {
  /** Model on stage. Models without a replica render an empty stage. */
  deviceType: IHardwareDeviceType;
  step: IDeviceStageStep;
  /**
   * The connected device's name (its Bluetooth model name) — the second
   * line under every step with the device in the picture, capsule and
   * card alike: the waits, the asks, the confirm. The outcome cards and
   * the teach-first intro keep their own words.
   */
  deviceName?: string;
  /**
   * The person's way out of the stage. Given, the surface wears its close
   * button and follows a downward drag; absent, it cannot be dismissed at
   * all. When to grant it is the driver's policy — the live hardware flows
   * arm it on a timer (a few seconds into an ask, longer into a wait) and
   * keep it armed for the rest of the burst; the authenticity flow arms it
   * from the start. The driver answers a dismissal by moving `step` to
   * `off` — the exit is already under way when this fires.
   */
  onClose?: () => void;
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
   * The authenticity checklist, shown under the words on `authVerifying`,
   * on `authSuccess` when the checklist flow is what succeeded, and
   * inside `authFailure` for the unofficial-firmware reason, failed row
   * marked. Omitted, the steps play their checklist-less shapes.
   */
  authChecklist?: IAuthChecklistItem[];
  /** Words and furniture the authFailure step wears. Defaults to 'unknown'. */
  authFailureReason?: IAuthFailureReason;
  /** The terminal failures' single exit — Support (the live flow raises
   * Intercom). Omitted, those cards render no button. */
  onAuthSupport?: () => void;
  /** The recoverable failures' first action — run the check again. */
  onAuthRetry?: () => void;
  /**
   * Continuing unverified, confirmed through the NOTE beat ("I
   * understand") — the recoverable failures' gated second exit. The
   * card's own Back returns to the failure without leaving the step.
   */
  onAuthContinueAnyway?: () => void;
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
}
