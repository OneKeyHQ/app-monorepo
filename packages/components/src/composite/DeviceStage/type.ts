import type { ReactNode } from 'react';

import type { IAirGapUrJson } from '@onekeyhq/qr-wallet-sdk';
import type { IDeviceStageErrorI18n } from '@onekeyhq/shared/types/deviceStage';

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
 * panel takes its place. `selectWalletType` is the wallet-creation fork
 * on passphrase-enabled devices — the live Select-wallet-type dialog in
 * stage vocabulary: standard or hidden, two option rows, chosen here in
 * the app, so the replica stays off stage; the choice rides out through
 * `onSelectWalletType`. `passphraseIntro` is the teach-first beat
 * before a hidden wallet is created: what a passphrase is and the facts
 * to hold before one exists to lose, with Continue as its single
 * action — reading material, so the replica stays off stage there too;
 * drivers route through it only when creating, never for plain entry.
 * `showQr` and `scanQr` are the air-gap pair — the app presents a code
 * for the device to scan, then the app's camera scans the code the
 * device shows back; the person is holding the device in both, so the
 * replica stays off stage there too.
 * `error` is the terminal failure beat, worded by `errorReason` — an ask
 * card with its one recovery action, or, actionless, the notice: the
 * failure resting as the capsule, ✗ beside the reason's title, leaving
 * on its own (see `onErrorAction`).
 *
 * `genuineCheck`, `authVerifying`, `authSuccess` and `authFailure` are
 * the device-authenticity flow (the live Genuine check): the ask — the
 * person confirms the check on the device — then the wait while the
 * certificate (and, on capable firmware, each component hash: the
 * `authChecklist`) is verified, then a landing. The three staged steps
 * keep the replica on stage as the confirm miniature, screens per the
 * scene map; `authFailure` fronts an icon instead of the replica, worded
 * by `authFailureReason`, with retry/support and a developer override.
 *
 * The rest of the vocabulary is the third-party track — Trezor and
 * Ledger flows, worn by the same stage with `vendor` set. Those devices
 * have no code-drawn replica, so their asks stay in the capsule (the
 * model's product shot on the left, see `vendorModel`) and their card
 * steps run app-input arrangements: `searching`/`confirmOnDevice`/
 * `openApp`/`unlockDevice` are capsule beats mapped straight off the
 * vendor SDKs' passive events; `done` is the burst's ✓ beat in the same
 * capsule (third-party only for now — whether OneKey flows adopt it is
 * an open call); `pairingCode` is Trezor THP's reverse handoff (the
 * device shows a code, the person types it here); `deviceNotFound`,
 * `btcHighIndex` and the install trio (`installConfirm` → `installing`,
 * or `installBatch` for the queued shape) are the vendor decision and
 * progress cards. The shared inputs — `pinOnApp` (the Trezor matrix is
 * the same blind pad minus its 0 key), `passphraseOnApp`, `connecting`,
 * `processing`, `error` — serve both tracks unchanged.
 */
export type IDeviceStageStep =
  | 'off'
  | 'connecting'
  | 'enterPin'
  | 'pinOnApp'
  | 'selectWalletType'
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
  | 'error'
  | 'searching'
  | 'confirmOnDevice'
  | 'openApp'
  | 'unlockDevice'
  | 'done'
  | 'pairingCode'
  | 'deviceNotFound'
  | 'btcHighIndex'
  | 'installConfirm'
  | 'installing'
  | 'installBatch';

/** The third-party vendors the stage can dress for. Values match
 * EHardwareVendor in @onekeyhq/shared/types/device. */
export type IDeviceStageVendor = 'ledger' | 'trezor';

/** The transport a burst rides. Desktop runs USB and Bluetooth side by
 * side, so the connecting wait tells them apart; which one is the
 * driver's knowledge, never looked up here. */
export type IDeviceStageConnectionType = 'bluetooth' | 'usb';

/** The wallet-creation fork's two answers — the live dialog's own pair:
 * a standard wallet (no passphrase) or a hidden one (passphrase or
 * hidden-wallet PIN). */
export type IDeviceStageWalletType = 'standard' | 'hidden';

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
 * Support is the only exit. The last three offer Retry and Support.
 * Mapping concrete SDK/server errors onto these is the integration
 * layer's.
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
  /** Model on stage. Models without a replica render an empty stage;
   * third-party flows (`vendor` set) omit it — their devices have no
   * code-drawn replica and the capsule wears the product shot instead. */
  deviceType?: IHardwareDeviceType;
  step: IDeviceStageStep;
  /**
   * Dresses the stage for a third-party device: the capsule's left seat
   * shows the vendor model's product shot (picked by `vendorModel`/
   * `vendorModelName` through the shared avatar mapping, brand-generic
   * fallback — Nano X / Safe 7 — when the model is unrecognized), and
   * the capsule speaks the vendor track's labels. Two device facts are
   * enforced here rather than left to driver wiring: the PIN pad wears
   * the Trezor matrix (no 0 key, no on-device switch — the button
   * devices that reach it cannot take the PIN themselves), and the
   * passphrase form drops the OneKey-only attach-PIN exit (on-device
   * entry stays — Trezor supports it). The driver knows the model from
   * the device row it is operating; the stage never looks anything up.
   */
  vendor?: IDeviceStageVendor;
  /** The vendor's model code (Ledger DMK code like `nanoX`/`stax`,
   * Trezor internal model like `T3W1`) — the avatar mapping's first key. */
  vendorModel?: string;
  /** The vendor's human model name (`Safe 7`) — the mapping's fallback
   * key when the code is absent. */
  vendorModelName?: string;
  /** The coin app the install steps talk about (`Ethereum`) — titles
   * and rows of `installConfirm`/`installing`. */
  appName?: string;
  /** Live install progress, 0–100 — `installing`'s bar and the active
   * row of `installBatch`. Real progress from the vendor SDK, never
   * simulated. */
  installProgress?: number;
  /** The batch install queue, in order — `installBatch`'s checklist. */
  installQueue?: string[];
  /** Index of the app currently installing; rows before it show done,
   * rows after wait. Defaults to 0. */
  installActiveIndex?: number;
  /** The BIP-44 path behind `btcHighIndex`'s warning copy. */
  btcHighIndexPath?: string;
  /** The account index parsed from that path. */
  btcHighIndexAccountIndex?: number;
  /** The `pairingCode` entry, confirmed — the code the person copied
   * off the device's screen. Empty is refused inline before this fires. */
  onPairingSubmit?: (code: string) => void;
  /** `deviceNotFound`'s single action — the person has reconnected and
   * unlocked the device; the driver retries. Omitted, no button. */
  onDeviceNotFoundRetry?: () => void;
  /** `deviceNotFound`'s self-check exit, the current UI's own pair with
   * Contact-us below: the driver opens the troubleshooting article (the
   * hardware help URL, or the vendor's own). Omitted, no button. */
  onDeviceNotFoundTroubleshoot?: () => void;
  /** The pair's second half — the live driver raises Intercom, the way
   * the current UI's dialog does. Omitted, no button. */
  onDeviceNotFoundSupport?: () => void;
  /** `btcHighIndex`'s single action — proceed with the non-standard
   * index, one device confirmation per path. Omitted, no button. */
  onBtcHighIndexConfirm?: () => void;
  /** `installConfirm`'s single action — install the missing app. The
   * driver answers by moving to `installing`. Omitted, no button. */
  onInstallConfirm?: () => void;
  /**
   * The connected device's name (its Bluetooth model name) — the second
   * line under every step with the device in the picture, capsule and
   * card alike: the waits, the asks, the confirm. The outcome cards and
   * the teach-first intro keep their own words.
   */
  deviceName?: string;
  /**
   * The transport this burst rides. `bluetooth` puts the Bluetooth
   * badge — the icon with its ripple — in the capsule's device seat for
   * the waiting beats (`connecting` and `processing` alike), in place
   * of the replica thumbnail: one glance says the wait is wireless
   * (desktop runs USB and Bluetooth side by side, and support reads it
   * off a screenshot). `usb` (and omitted) keeps the replica — the
   * plugged-in device standing there IS the wired look. The vendor
   * track ignores it: that seat wears the product shot.
   */
  connectionType?: IDeviceStageConnectionType;
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
   * The confirm step's payload, three shapes — rows (`confirmDetails`),
   * a text block (`confirmMessage`), or a description (`confirmDescription`)
   * — one per burst, all on the same card and the same late fade-in.
   * Copy rule for whichever shape rides in: the card is the app's half
   * of a comparison, never a mirror of the device — say "check this
   * against the device", never "this is what the device shows". The two
   * renderings disagreeing is the ritual's whole point.
   *
   * Rows: label over value, one card — the on-screen copy of what must
   * be verified against the device. `highlightEnds` gives a value the
   * receive page's address grammar (mono, grouped by four, first and
   * last six characters highlighted); `warning` inks the value amber
   * (an unlimited allowance).
   */
  confirmDetails?: Array<{
    label: string;
    value: string;
    highlightEnds?: boolean;
    warning?: boolean;
  }>;
  /**
   * The text-block shape: the signed original (a personal message), the
   * very text the person pages through on the device. Long content
   * truncates — the device screen stays the full read.
   */
  confirmMessage?: string;
  /**
   * The description shape: device actions with no payload to list — one
   * line on what confirming does (enable passphrase, wipe). With
   * `confirmDescriptionDanger` the panel inks destructive (wipe).
   */
  confirmDescription?: string;
  confirmDescriptionDanger?: boolean;
  /**
   * The burst's place in a run of confirmations — approve-then-swap,
   * batch sends — worn as a "current / total" pill beside the title, on
   * the payload card's own beat. Confirm bursts only.
   */
  confirmCount?: { current: number; total: number };
  /**
   * Payload of the code the showQr step presents for the device to scan.
   * Multi-part rotation for large payloads belongs to the integration
   * layer, inside the same step.
   */
  qrValue?: string;
  /**
   * The animated multi-part shape of the same payload — an air-gap UR.
   * Given, it outranks `qrValue`: the panel's QRCode rotates the parts
   * itself (and draws the line style device cameras can lock on), so the
   * integration layer hands over the UR json and owns nothing else.
   */
  qrValueUr?: IAirGapUrJson;
  /**
   * The live camera preview for scanQr's viewfinder window — the stage
   * fixes where the window sits and how it is framed, the integration
   * layer supplies what looks out of it (a components package cannot
   * reach the app's camera). Absent, the window keeps its placeholder
   * face; the scan progress badge is the view's own concern.
   */
  qrScannerView?: ReactNode;
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
   * The failure's own words, for the outcomes no `errorReason` claims —
   * the driver hands over the message the error already carries, which
   * the live flow's toast used to speak. Display-ready. It stands in for
   * the generic title only: a reason's own words always win, and its
   * `sub` and action are unaffected.
   */
  errorMessage?: string;
  /** Translate in the UI runtime, whose locale messages are loaded. */
  errorI18n?: IDeviceStageErrorI18n;
  /**
   * The authenticity checklist, shown under the words on `authVerifying`,
   * on `authSuccess` when the checklist flow is what succeeded, and
   * inside `authFailure` for the unofficial-firmware reason, failed row
   * marked. Omitted, the steps play their checklist-less shapes.
   */
  authChecklist?: IAuthChecklistItem[];
  /** Words and furniture the authFailure step wears. Defaults to 'unknown'. */
  authFailureReason?: IAuthFailureReason;
  /** @deprecated Raw authentication failures are never displayed. */
  authFailureMessage?: string;
  /** @deprecated Authentication error codes are never displayed. */
  authFailureCode?: string;
  /** The terminal failures' single exit — Support (the live flow raises
   * Intercom). Omitted, those cards render no button. */
  onAuthSupport?: () => void;
  /** The recoverable failures' first action — run the check again. */
  onAuthRetry?: () => void;
  /** Allow manual continuation after any failed check in developer mode. */
  allowAuthDevSkip?: boolean;
  /** Continue unverified through the developer or legacy hidden override. */
  onAuthContinueAnyway?: () => void;
  /**
   * The error step's single recovery action — retry, reconnect — on its
   * ask card. Without it the step plays as the notice, for the many
   * failures that have no honest retry: the stage rests as the capsule —
   * the failure ✗ beside the reason's title, no second line, no button —
   * and after a readable hold requests its own exit through `onClose`, so
   * a driver that means the error to leave by itself grants close along
   * with it.
   */
  onErrorAction?: () => void;
  /** The pinOnApp entry, confirmed. The driver decides what follows. */
  onPinSubmit?: (pin: string) => void;
  /**
   * enterPin's in-place switch back to app entry (OK-61489): providing
   * this renders the "Prefer to enter PIN in app?" line in the
   * description seat, so the wiring side owns eligibility — button
   * device, on-device entry stored as the default, not a mid-request
   * hop from the app pad, not attach-PIN. It should persist the
   * preference (effective next request; the current one still finishes
   * on the device). Resolving flips the line into the set-to-app
   * banner; a rejection keeps the entry line for another try.
   */
  onSwitchPinInputToApp?: () => void | Promise<void>;
  /**
   * The selectWalletType choice, made — the fork's only exit (stepping
   * away is the surface's own dismissal). The driver decides what
   * follows: the live flow heads into creating the standard wallet, or
   * into the hidden-wallet passphrase flow. Omitted, the step renders
   * its title alone, no rows.
   */
  onSelectWalletType?: (walletType: IDeviceStageWalletType) => void;
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
   * Where the intro's shortcut switch starts — the person's remembered
   * choice (the wallet-list preference the integration layer persists).
   * Omitted, the switch starts ON, the first-run default.
   */
  passphraseIntroKeepShortcut?: boolean;
  /**
   * Which shape the passphrase step takes — the live flow's two:
   * 'verify' (unlock an existing hidden wallet: the step's own title) or
   * 'create' (the Add-hidden-wallet flow: the step titles itself after
   * it and carries the Keep-accessible preference). Both refuse an empty
   * entry inline. Defaults to 'verify', the plain entry shape.
   */
  passphraseMode?: 'create' | 'verify';
  /**
   * Where the create form's Keep-accessible switch starts — the person's
   * remembered choice, which the driver owns (it lives in a persisted
   * setting there). Read on each activation of the form, never live: a
   * background settings sync must not flip the switch under a hand that
   * is typing. Omitted, the switch starts ON — the first-run default, and
   * what the gallery shows.
   */
  passphraseKeepAccessible?: boolean;
  /**
   * The request comes from a protocol V2 device: the passphrase form takes
   * UTF-8 measured in bytes and normalizes it to NFKD, the way the shipped
   * dialog did for the wallet-session coordinator's requests. Off, the
   * printable-ASCII rule applies.
   */
  passphraseAllowUtf8?: boolean;
  /**
   * The passphraseOnApp entry, confirmed — never empty, which the form
   * refuses inline in both modes (on-device entry is the one way to
   * answer with an empty passphrase, and it exits through
   * `onSwitchToDevice`). In create mode `keepAccessible` rides along —
   * whether the new hidden wallet stays after the app closes (the
   * Keep-accessible switch). The live flow treats that as a preference
   * every exit shares, so the device switch and the attach-PIN action
   * carry the same options; in verify mode they are absent everywhere.
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
