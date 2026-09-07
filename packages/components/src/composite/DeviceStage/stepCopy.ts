import type { ComponentProps } from 'react';

import { TREZOR_THP_APP_NAME } from '@onekeyhq/shared/src/hardware/trezorThpIdentity';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDeviceStageErrorI18n } from '@onekeyhq/shared/types/deviceStage';

import type {
  IAuthFailureReason,
  IDeviceStageErrorReason,
  IDeviceStageStep,
} from './type';
import type { HardwareDevice } from '../../content/HardwareDevice';
import type { IKeyOfIcons } from '../../primitives';
import type { IntlShape } from 'react-intl';

/**
 * The stage's vocabulary: which steps exist, what they say, what pose
 * and scene they wear — plus the resolution rules for the words that
 * vary at runtime. The tables hold translation ids; the resolvers turn
 * them into words through the caller's `intl`, so the copy follows the
 * app's locale. Pure data and pure functions; how the stage plays them
 * is the engine's own business (see ./index).
 */

export function resolveErrorMessage(
  intl: IntlShape,
  message?: string,
  errorI18n?: IDeviceStageErrorI18n,
): string | undefined {
  const key = errorI18n?.key;
  if (key && intl.messages[key]) {
    return intl.formatMessage(
      { id: key, defaultMessage: message },
      errorI18n.info,
    );
  }
  return message;
}

// `off` has no words of its own: searching is part of connecting, so the
// copy is in place from the first frame and holds still while the screen
// renders its content in — one id, shared, so they cannot drift.
export const CONNECTING_TEXT = {
  title: ETranslations.device_stage_connecting__title,
};

/**
 * Failure copy by reason, each with its single recovery action. The stage
 * ends on the surface it played on: no toast, no second dialog. The
 * actionless notice shape speaks the title alone, as the capsule; `sub`
 * and `action` go unworn there.
 */
export const ERROR_TEXT: Record<
  IDeviceStageErrorReason | 'generic',
  { title: ETranslations; sub: ETranslations; action: ETranslations }
> = {
  rejected: {
    title: ETranslations.device_stage_canceled_on_device__title,
    sub: ETranslations.device_stage_canceled_on_device__desc,
    action: ETranslations.global_try_again,
  },
  pinInvalid: {
    title: ETranslations.device_stage_wrong_pin__title,
    sub: ETranslations.device_stage_wrong_pin__desc,
    action: ETranslations.device_stage_reenter_pin__action,
  },
  disconnected: {
    title: ETranslations.hardware_third_party_device_disconnected,
    sub: ETranslations.device_stage_disconnected__desc,
    action: ETranslations.device_stage_reconnect__action,
  },
  busy: {
    title: ETranslations.device_stage_device_busy__title,
    sub: ETranslations.device_stage_device_busy__desc,
    action: ETranslations.global_try_again,
  },
  generic: {
    title: ETranslations.device_stage_generic_error__title,
    sub: ETranslations.device_stage_generic_error__desc,
    action: ETranslations.global_try_again,
  },
};

/**
 * The authenticity flow's failure copy, the live dialog's own keys (the
 * design drops the old error-code suffixes). `action` picks the card's
 * exits: 'support' is terminal; 'retry' offers Retry and Support but never
 * bypasses authenticity verification.
 * The icon fronts the card where the staged steps front the replica.
 */
export const AUTH_FAILURE_TEXT: Record<
  IAuthFailureReason,
  {
    title: ETranslations;
    sub: ETranslations;
    icon: IKeyOfIcons;
    action: 'support' | 'retry';
  }
> = {
  unofficialDevice: {
    title: ETranslations.device_auth_unofficial_device_detected,
    sub: ETranslations.device_auth_unofficial_device_detected_help_text,
    icon: 'ErrorSolid',
    action: 'support',
  },
  unofficialFirmware: {
    title: ETranslations.device_auth_unofficial_device_detected,
    sub: ETranslations.device_auth_unofficial_device_detected_help_text,
    icon: 'ErrorSolid',
    action: 'support',
  },
  defective: {
    title: ETranslations.hardware_defective_firmware_error_title,
    sub: ETranslations.hardware_defective_firmware_error,
    icon: 'ErrorSolid',
    action: 'support',
  },
  network: {
    title: ETranslations.global_network_error,
    sub: ETranslations.global_network_error_help_text,
    icon: 'GlobusSolid',
    action: 'retry',
  },
  unknown: {
    title: ETranslations.send_verification_failure,
    sub: ETranslations.global_unknown_error_retry_message,
    icon: 'ErrorSolid',
    action: 'retry',
  },
  unavailable: {
    title: ETranslations.device_auth_temporarily_unavailable,
    sub: ETranslations.device_auth_temporarily_unavailable_help_text,
    icon: 'ServerSolid',
    action: 'retry',
  },
};

/**
 * Wallet grammar: an instruction-first title, one informative line
 * under. The device's own name rides the second line nowhere anymore —
 * on the device-side card steps it wears the title's pill instead (see
 * DEVICE_BADGE_STEPS), and the capsule keeps it as its own second line.
 *
 * Entries whose words carry runtime values (the pairing pitch, the
 * device-not-found pair, the high-index warning, the install steps)
 * resolve through their own resolvers below — the table keeps only
 * their parameter-free ids, so a generic consumer never meets an
 * unfilled placeholder.
 */
export const STEP_TEXT: Record<
  IDeviceStageStep,
  { title: ETranslations; sub?: ETranslations }
> = {
  off: CONNECTING_TEXT,
  connecting: CONNECTING_TEXT,
  // Titles name the place only when it is not here: the app is where the
  // person already is, so app-side steps stay bare and device-side steps
  // carry "on device" — the one fact that changes when a step hops sides.
  // No sub: the old "Unlock your device." line retired for the
  // switch-to-app entry (OK-61489), which the stage panel renders as an
  // interactive line in the same seat — see pinSwitchSlot in index.
  enterPin: {
    title: ETranslations.enter_pin_enter_on_device,
  },
  pinOnApp: { title: ETranslations.device_stage_enter_pin__title },
  // The wallet-creation fork's title, the ratified design's own words
  // (Figma 21912-35639) on its own key. No sub — the two options carry
  // their copy in the panel (see WalletTypeOptions).
  selectWalletType: {
    title: ETranslations.device_stage_select_wallet_type__title,
  },
  // The teach-first beat titles itself after the flow it opens (the live
  // dialog's own name). No sub on purpose: the definition line needs an
  // emphasized word — rich text the panel carries itself (see
  // PassphraseIntro).
  passphraseIntro: { title: ETranslations.global_add_hidden_wallet },
  // No sub for now — the right second line is still being decided.
  enterPassphrase: {
    title: ETranslations.device_stage_enter_passphrase_on_device__title,
  },
  passphraseOnApp: { title: ETranslations.global_enter_passphrase },
  showQr: { title: ETranslations.device_stage_show_qr__title },
  scanQr: {
    title: ETranslations.device_stage_scan_qr__title,
    sub: ETranslations.device_stage_scan_qr__desc,
  },
  confirm: { title: ETranslations.global_confirm_on_device },
  genuineCheck: {
    title: ETranslations.device_auth_request_title,
    sub: ETranslations.device_auth_request_desc,
  },
  authVerifying: {
    title: ETranslations.device_auth_verifying_title,
    sub: ETranslations.device_auth_verifying_desc,
  },
  authSuccess: {
    title: ETranslations.device_auth_successful_title,
    sub: ETranslations.device_auth_successful_desc,
  },
  // The step's real words come off AUTH_FAILURE_TEXT by reason; this is
  // the Record's required fallback, matching the 'unknown' shape.
  authFailure: {
    title: AUTH_FAILURE_TEXT.unknown.title,
    sub: AUTH_FAILURE_TEXT.unknown.sub,
  },
  processing: { title: ETranslations.device_stage_processing__title },
  error: ERROR_TEXT.generic,
  // The third-party track. Capsule labels ride the vendor SDKs' own
  // vocabulary (the ratified board keeps their wording); the card steps
  // with runtime words — vendor, app name, path — resolve below.
  searching: { title: ETranslations.hardware_searching_for_device },
  confirmOnDevice: { title: ETranslations.global_confirm_on_device },
  openApp: { title: ETranslations.hardware_third_party_app_not_open },
  unlockDevice: { title: ETranslations.hardware_third_party_device_locked },
  done: { title: ETranslations.global_done },
  pairingCode: { title: ETranslations.trezor_thp_pairing__title },
  // The current UI's Device-not-connected dialog, verbatim — same title,
  // same lead-in question; the card's whole body matches it word for
  // word (the button pair included, see the panel).
  deviceNotFound: {
    title: ETranslations.device_not_connected,
    sub: ETranslations.troubleshooting_show_helper_cta_label,
  },
  btcHighIndex: {
    title: ETranslations.hardware_third_party_btc_high_index_confirm_title,
    sub: ETranslations.device_stage_btc_high_index__desc,
  },
  installConfirm: { title: ETranslations.device_stage_install_app__title },
  installing: {
    title: ETranslations.device_stage_install_app__title,
    sub: ETranslations.device_stage_processing__title,
  },
  installBatch: {
    title: ETranslations.global_get_started,
    sub: ETranslations.hardware_third_party_app_install_required_desc,
  },
};

/** The vendors' display names, for the cards that address the brand.
 * Brand names, not translations. */
export const VENDOR_LABEL: Record<'ledger' | 'trezor', string> = {
  ledger: 'Ledger',
  trezor: 'Trezor',
};

/** `connecting` worn by the vendor track: the board's own label — the
 * capsule has no device-name line there, so the title carries it. */
export const VENDOR_CONNECTING_TEXT = {
  title: ETranslations.connecting_your_device,
};

/** `pairingCode`'s words: the pitch names the app by its THP handshake
 * identity — the same name the Trezor's own screen shows. */
export function resolvePairingCodeText(intl: IntlShape): {
  title: string;
  sub: string;
} {
  return {
    title: intl.formatMessage({ id: STEP_TEXT.pairingCode.title }),
    sub: intl.formatMessage(
      { id: ETranslations.trezor_thp_pairing__desc },
      { appName: TREZOR_THP_APP_NAME, device: VENDOR_LABEL.trezor },
    ),
  };
}

/** `deviceNotFound`'s words, addressed to the brand. */
export function resolveDeviceNotFoundText(
  intl: IntlShape,
  vendor?: 'ledger' | 'trezor',
): {
  title: string;
  sub: string;
} {
  if (!vendor) {
    return resolveStageText(intl, 'deviceNotFound');
  }
  const label = VENDOR_LABEL[vendor];
  return {
    title: intl.formatMessage(
      { id: ETranslations.device_stage_connect_vendor__title },
      { vendor: label },
    ),
    sub: intl.formatMessage(
      { id: ETranslations.device_stage_connect_vendor__desc },
      { vendor: label },
    ),
  };
}

/** `btcHighIndex`'s warning, current-UI verbatim, path and index in. */
export function resolveBtcHighIndexSub(
  intl: IntlShape,
  path?: string,
  accountIndex?: number,
): string {
  return intl.formatMessage(
    { id: ETranslations.hardware_third_party_btc_high_index_confirm_desc },
    { accountIndex: accountIndex ?? '', path: path ?? '' },
  );
}

/** The install steps' words around the app's name. Without a name the
 * title falls back to the bare form and the sentence names it "app". */
export function resolveInstallText(
  intl: IntlShape,
  step: 'installConfirm' | 'installing',
  appName?: string,
): { title: string; sub: string } {
  if (step === 'installConfirm') {
    return {
      title: appName
        ? intl.formatMessage(
            { id: ETranslations.hardware_third_party_install_app__title },
            { appName },
          )
        : intl.formatMessage({ id: STEP_TEXT.installConfirm.title }),
      sub: intl.formatMessage(
        { id: ETranslations.hardware_third_party_install_app__desc },
        { appName: appName ?? 'app' },
      ),
    };
  }
  return {
    title: appName
      ? intl.formatMessage(
          {
            id: ETranslations.hardware_third_party_install_app_in_progress__title,
          },
          { appName },
        )
      : intl.formatMessage({ id: STEP_TEXT.installing.title }),
    sub: resolveStepSub(intl, 'installing'),
  };
}

/**
 * The card steps that wear the device's name as the title's pill — the
 * ones where the person acts on the connected device, so the card names
 * which device to reach for. The authenticity flow keeps it through its
 * landing: the three beats share one card, and the board keeps the name
 * on Verification successful rather than blinking it out under the ✓.
 * The app-side inputs (PIN, passphrase, the teach-first intro) and the
 * failure cards stay bare: the person acts here, and the badge would
 * name the wrong place. The air-gap pair is device-side but stays bare
 * too — no live transport, so there is no Bluetooth name to wear.
 */
export const DEVICE_BADGE_STEPS: ReadonlySet<IDeviceStageStep> =
  new Set<IDeviceStageStep>([
    'enterPin',
    'enterPassphrase',
    'confirm',
    'genuineCheck',
    'authVerifying',
    'authSuccess',
  ]);

/** A step's second line: its own informative line, empty when none. */
export function resolveStepSub(
  intl: IntlShape,
  step: IDeviceStageStep,
): string {
  const sub = STEP_TEXT[step].sub;
  return sub ? intl.formatMessage({ id: sub }) : '';
}

/**
 * The passphrase step's other name: creating a hidden wallet titles the
 * step after the flow it performs — the live Add-hidden-wallet dialog's
 * title — while plain entry keeps the step's own words above.
 */
export const PASSPHRASE_CREATE_TEXT = {
  title: ETranslations.global_add_hidden_wallet,
};

/**
 * What the replica's screen plays per step. The endings go dark: the
 * stage mirrors state, it does not invent what the physical screen
 * shows. The app-side inputs, the air-gap pair and the waiting card
 * beats have no replica on stage at all.
 */
export const SCENE_ANIMATION: Record<
  IDeviceStageStep,
  ComponentProps<typeof HardwareDevice>['animation']
> = {
  off: undefined,
  connecting: 'connecting',
  enterPin: 'enterPin',
  pinOnApp: undefined,
  selectWalletType: undefined,
  passphraseIntro: undefined,
  enterPassphrase: 'enterPassphrase',
  passphraseOnApp: undefined,
  showQr: undefined,
  scanQr: undefined,
  confirm: 'confirm',
  // The authenticity flow's screens: the ask mirrors the device's own
  // confirm prompt; the wait plays dark (its screen is undecided); the
  // landing rests on the idle wallpaper. The failure card has no replica.
  genuineCheck: 'confirm',
  authVerifying: undefined,
  authSuccess: 'connecting',
  authFailure: undefined,
  processing: undefined,
  error: undefined,
  // The third-party track never lights the replica: those devices have
  // no code-drawn twin, so no step maps to a scene.
  searching: undefined,
  confirmOnDevice: undefined,
  openApp: undefined,
  unlockDevice: undefined,
  done: undefined,
  pairingCode: undefined,
  deviceNotFound: undefined,
  btcHighIndex: undefined,
  installConfirm: undefined,
  installing: undefined,
  installBatch: undefined,
};

/**
 * Which rest pose a step belongs to: absent before the burst has
 * anything to say, the capsule for waiting beats — nothing is asked of
 * the person — and the card for everything else.
 */
export const STEP_POSE: Record<
  IDeviceStageStep,
  'hidden' | 'capsule' | 'card'
> = {
  off: 'hidden',
  connecting: 'capsule',
  processing: 'capsule',
  enterPin: 'card',
  pinOnApp: 'card',
  selectWalletType: 'card',
  passphraseIntro: 'card',
  enterPassphrase: 'card',
  passphraseOnApp: 'card',
  showQr: 'card',
  scanQr: 'card',
  confirm: 'card',
  genuineCheck: 'card',
  authVerifying: 'card',
  authSuccess: 'card',
  authFailure: 'card',
  // The ask shape's rest pose. The actionless notice rests as the
  // capsule instead — a prop-dependent fact the engine derives itself.
  error: 'card',
  // Third-party: the passive vendor events stay in the capsule — the
  // person acts on the physical device, nothing is asked in the app —
  // and `done` lands its ✓ there too; the decision, input and progress
  // beats are cards.
  searching: 'capsule',
  confirmOnDevice: 'capsule',
  openApp: 'capsule',
  unlockDevice: 'capsule',
  done: 'capsule',
  pairingCode: 'card',
  deviceNotFound: 'card',
  btcHighIndex: 'card',
  installConfirm: 'card',
  installing: 'card',
  installBatch: 'card',
};

/**
 * The staged steps — the ones that keep the replica on stage. The full
 * stage crops the device to screen-and-keys for the device-side asks;
 * the compact list wears the confirm miniature instead — confirm's own
 * shrink, and the authenticity flow, which keeps the whole device in
 * view while the card talks. The engine derives its port map (and the
 * miniature's scale) from these two lists, so membership is stated once.
 */
export const FULL_STAGED_STEPS: IDeviceStageStep[] = [
  'enterPin',
  'enterPassphrase',
];
export const COMPACT_STAGED_STEPS: IDeviceStageStep[] = [
  'confirm',
  'genuineCheck',
  'authVerifying',
  'authSuccess',
];

/** The stage seat's words, resolved: the step's title over its own line
 * (the device's name lives on the title's pill now). */
export function resolveStageText(
  intl: IntlShape,
  step: IDeviceStageStep,
): {
  title: string;
  sub: string;
} {
  return {
    title: intl.formatMessage({ id: STEP_TEXT[step].title }),
    sub: resolveStepSub(intl, step),
  };
}

/** The passphrase panel's words: create mode titles the step after the
 * flow it performs, plain entry keeps the step's own title. No second
 * line — the app-side input is where the person acts, and the form's
 * own furniture carries the teaching. */
export function resolvePassphrasePanelText(
  intl: IntlShape,
  mode: 'create' | 'verify' | undefined,
): {
  title: string;
  sub: string;
} {
  return {
    title: intl.formatMessage({
      id:
        mode === 'create'
          ? PASSPHRASE_CREATE_TEXT.title
          : STEP_TEXT.passphraseOnApp.title,
    }),
    sub: resolveStepSub(intl, 'passphraseOnApp'),
  };
}

/** The capsule's words: the live step's title over the device's name —
 * the flow spec's connecting-capsule pairing, kept. The vendor track
 * speaks single labels (the board carries no device-name line there),
 * with `connecting` reworded to say what the missing line said. Only
 * capsule-pose steps reach here — including the actionless error, the
 * notice, which speaks its reason's title alone on either track. */
export function resolveCapsuleText(
  intl: IntlShape,
  step: IDeviceStageStep,
  deviceName?: string,
  vendor?: 'ledger' | 'trezor',
  errorReason?: IDeviceStageErrorReason,
  errorMessage?: string,
): { title: string; sub: string } {
  if (step === 'error') {
    return {
      // The failure's own words when no reason claims it — the message
      // the live flow's toast used to speak. A reason's considered
      // wording always wins over it.
      title:
        !errorReason && errorMessage
          ? errorMessage
          : intl.formatMessage({
              id: ERROR_TEXT[errorReason ?? 'generic'].title,
            }),
      sub: '',
    };
  }
  if (vendor) {
    return {
      title: intl.formatMessage({
        id:
          step === 'connecting'
            ? VENDOR_CONNECTING_TEXT.title
            : STEP_TEXT[step].title,
      }),
      sub: '',
    };
  }
  return {
    title: intl.formatMessage({ id: STEP_TEXT[step].title }),
    sub: deviceName ?? '',
  };
}
