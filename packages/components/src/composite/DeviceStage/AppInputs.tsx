import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { MARK_IN_MS, easeOutFn } from '../../content/deviceScene';
import { Input, passwordManagerIgnoreProps } from '../../forms/Input';
import {
  Anchor,
  Button,
  Haptics,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '../../primitives';

import {
  normalizePassphraseEntry,
  resolvePassphraseEntryFailure,
} from './passphraseRules';
import { PreferenceCapsule } from './PreferenceCapsule';

/**
 * The app-side input panels: the steps where the person types in the app
 * while the device waits, so no replica is on stage. Both carry the
 * production inputs' interaction grammar and safety furniture — the blind
 * position entry with its nine-digit cap, the passphrase form's masking,
 * loss warning and character rules. The PIN pad's visuals follow the
 * ratified sheet spec: gapped keys, and a single strip that plays hint,
 * dots and errors in turn.
 */

/** Classic-family PINs cap at nine digits (the production keypad's cap). */
const MAX_PIN_LENGTH = 9;

/**
 * Key values double as the wire encoding: the grid position pressed, laid
 * out numpad-style. The faces stay blind — a dot, not the digit — because
 * the digit under each position lives only on the device's screen.
 */
const PIN_KEY_ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['delete', '0', 'confirm'],
] as const;

/** The Trezor matrix: the same blind pad minus its 0 — Trezor PINs are
 * nine positions, so the slot between delete and confirm stays empty. */
const PIN_KEY_ROWS_NO_ZERO = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['delete', '', 'confirm'],
] as const;

type IPinKeyValue = (typeof PIN_KEY_ROWS)[number][number];

const KEY_HOVER = { bg: '$bgStrongHover' } as const;
const KEY_PRESS = { bg: '$bgStrongActive' } as const;
const KEY_FOCUS = {
  outlineColor: '$focusRing',
  outlineOffset: -2,
  outlineWidth: 2,
  outlineStyle: 'solid',
} as const;

/** The refusal beat: a quick sideways shake of the strip's content. */
const SHAKE_DISTANCE = 5;
const SHAKE_STEP_MS = 50;

/* The device screens' mark grammar, played live: a landing dot fades in on
 * the screens' own beat while the already-landed row eases half a slot
 * over to stay centered. Deletion is not a performance — the dot leaves at
 * once and the row settles through the same slide. (No exiting animations:
 * they leave dummies behind on web.) */
const DOT_IN = FadeIn.duration(MARK_IN_MS).easing(easeOutFn);
const DOT_SLIDE = LinearTransition.duration(MARK_IN_MS).easing(easeOutFn);

// Memoized: `onKey` is stable (its value rides a ref), so a keypress
// re-renders the dots strip alone instead of all twelve keys' Tamagui
// style resolution on the same JS beat as the dot's layout transition.
const PinKey = memo(function PinKey({
  value,
  onKey,
}: {
  value: IPinKeyValue;
  onKey: (value: IPinKeyValue) => void;
}) {
  const handlePress = useCallback(() => onKey(value), [onKey, value]);
  return (
    <Stack
      testID={`device-stage-pin-key-${value}`}
      flex={1}
      h="$14"
      borderRadius="$4"
      borderCurve="continuous"
      bg="$bgStrong"
      justifyContent="center"
      alignItems="center"
      hoverStyle={KEY_HOVER}
      pressStyle={KEY_PRESS}
      focusable
      focusVisibleStyle={KEY_FOCUS}
      onPress={handlePress}
    >
      {value === 'delete' || value === 'confirm' ? (
        <Icon
          size="$6"
          name={value === 'delete' ? 'XBackspaceSolid' : 'Checkmark2Solid'}
          color="$iconStrong"
        />
      ) : (
        <Stack w="$2" h="$2" borderRadius="$full" bg="#FFFFFF" />
      )}
    </Stack>
  );
});

export interface IPinPadProps {
  onSubmit?: (pin: string) => void;
  onSwitchToDevice?: () => void;
  /**
   * One-line inline failure that takes over the strip — the retry-in-place
   * state. Its arrival clears the typed value: the previous entry was
   * consumed and refused. It steps aside again on the first new keypress.
   */
  error?: string;
  /**
   * Fresh-visit signal for presenters that keep the pad mounted between
   * visits (the overlay's parked panel seats): each change clears the
   * entry and its strip states — the clean slate a remount used to
   * provide. Presenters that remount per visit just leave it unset.
   */
  resetSignal?: number;
  /** The Trezor matrix shape: nine positions, no 0 key — the slot
   * between delete and confirm renders empty. */
  noZeroKey?: boolean;
}

export function PinPad({
  onSubmit,
  onSwitchToDevice,
  error,
  resetSignal,
  noZeroKey,
}: IPinPadProps) {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const valueRef = useRef(value);
  valueRef.current = value;
  // The failure line lives until the person starts correcting: the first
  // new digit retires it, so "wrong" and "new entry" never coexist.
  const [errorRetired, setErrorRetired] = useState(false);
  // The local refusal: confirm pressed on an empty entry.
  const [emptyPrompt, setEmptyPrompt] = useState(false);
  useEffect(() => {
    if (error) {
      setValue('');
      setErrorRetired(false);
      setEmptyPrompt(false);
    }
  }, [error]);
  useEffect(() => {
    setValue('');
    setErrorRetired(false);
    setEmptyPrompt(false);
  }, [resetSignal]);

  const shakeX = useSharedValue(0);
  const shake = useCallback(() => {
    cancelAnimation(shakeX);
    shakeX.value = 0;
    shakeX.value = withSequence(
      withTiming(-SHAKE_DISTANCE, { duration: SHAKE_STEP_MS }),
      withTiming(SHAKE_DISTANCE, { duration: SHAKE_STEP_MS }),
      withTiming(-SHAKE_DISTANCE * 0.6, { duration: SHAKE_STEP_MS }),
      withTiming(0, { duration: SHAKE_STEP_MS }),
    );
  }, [shakeX]);
  const shakeStyle = useAnimatedStyle(
    () => ({ transform: [{ translateX: shakeX.value }] }),
    [shakeX],
  );

  const handleKey = useCallback(
    (key: IPinKeyValue) => {
      // Every key answers the finger with the lightest tick: the pad is
      // blind and the eyes are on the device's screen, so the tactile
      // ack does the confirmation vision can't.
      Haptics.selection();
      if (key === 'delete') {
        setValue((v) => v.slice(0, -1));
        return;
      }
      if (key === 'confirm') {
        // An empty confirm is refused like any refusal — prompt plus
        // shake. The ratified call: better usability than a disabled key.
        if (!valueRef.current.length) {
          setEmptyPrompt(true);
          shake();
          return;
        }
        onSubmit?.(valueRef.current);
        return;
      }
      setErrorRetired(true);
      setEmptyPrompt(false);
      // Full is full: refuse the tenth digit with the same shake the
      // refusal beat uses, instead of silently swallowing the press.
      if (valueRef.current.length >= MAX_PIN_LENGTH) {
        shake();
        return;
      }
      setValue((v) => (v.length >= MAX_PIN_LENGTH ? v : v + key));
    },
    [onSubmit, shake],
  );

  const dots = useMemo(
    () => Array.from({ length: value.length }, (_, index) => index),
    [value.length],
  );
  const externalError = error && !errorRetired ? error : undefined;
  // Refusing an empty confirm: a prompt in place of a disabled key.
  const shownError =
    externalError ??
    (emptyPrompt
      ? intl.formatMessage({
          id: ETranslations.device_stage_enter_pin_first__msg,
        })
      : undefined);
  return (
    <YStack gap="$2">
      <YStack
        p="$4"
        borderRadius="$4"
        borderCurve="continuous"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor={shownError ? '$borderCritical' : '$borderSubdued'}
        bg={shownError ? '$bgCriticalSubdued' : '$blackA5'}
      >
        <Animated.View style={shakeStyle}>
          <XStack
            minHeight="$6"
            gap="$6"
            alignItems="center"
            justifyContent="center"
          >
            {shownError ? (
              <SizableText
                size="$bodyLg"
                color="$textCritical"
                textAlign="center"
              >
                {shownError}
              </SizableText>
            ) : null}
            {!shownError && value.length
              ? dots.map((dot) => (
                  <Animated.View key={dot} entering={DOT_IN} layout={DOT_SLIDE}>
                    <Stack w="$2" h="$2" borderRadius="$full" bg="#FFFFFF" />
                  </Animated.View>
                ))
              : null}
            {!shownError && !value.length ? (
              // Just-in-time teaching at the point of confusion: why the
              // keys carry no digits. It yields to the dots on first entry.
              <SizableText
                size="$bodyLg"
                color="$textSubdued"
                textAlign="center"
              >
                {intl.formatMessage({
                  id: ETranslations.device_stage_pin_keypad__desc,
                })}
              </SizableText>
            ) : null}
          </XStack>
        </Animated.View>
      </YStack>
      {(noZeroKey ? PIN_KEY_ROWS_NO_ZERO : PIN_KEY_ROWS).map((row) => (
        <XStack key={row[0]} gap="$2">
          {row.map((key, keyIndex) =>
            key === '' ? (
              // The Trezor matrix's empty slot: space held, no key face.
              <Stack key={`blank-${keyIndex}`} flex={1} h="$14" />
            ) : (
              <PinKey key={key} value={key} onKey={handleKey} />
            ),
          )}
        </XStack>
      ))}
      {onSwitchToDevice ? (
        <XStack
          testID="device-stage-pin-switch-on-device"
          h="$14"
          gap="$2"
          borderRadius="$4"
          borderCurve="continuous"
          alignItems="center"
          justifyContent="center"
          hoverStyle={KEY_HOVER}
          pressStyle={KEY_PRESS}
          focusable
          focusVisibleStyle={KEY_FOCUS}
          onPress={onSwitchToDevice}
        >
          <Icon size="$5" name="SwitchHorOutline" color="$iconSubdued" />
          <SizableText size="$bodyLg" color="$textSubdued">
            {intl.formatMessage({ id: ETranslations.global_enter_on_device })}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}

export interface IPassphraseFormProps {
  /**
   * The live flow's two shapes: 'create' is the Add-hidden-wallet flow
   * (the stage titles it that) and carries the Keep-accessible
   * preference; 'verify' unlocks an existing hidden wallet. Both refuse
   * an empty entry — see handleConfirm. Defaults to 'verify', the plain
   * entry shape the flow spec draws.
   */
  mode?: 'create' | 'verify';
  /**
   * In create mode `keepAccessible` rides along: whether the new hidden
   * wallet stays after the app closes — the Keep-accessible switch. The
   * live flow treats it as a preference every exit shares, so the device
   * switch and the attach-PIN path carry the same option; in verify mode
   * (no switch, nothing being created) the options are absent everywhere.
   */
  onSubmit?: (
    passphrase: string,
    options?: { keepAccessible: boolean },
  ) => void;
  onSwitchToDevice?: (options?: { keepAccessible: boolean }) => void;
  /**
   * Shows the "Enter Hidden Wallet PIN" alternative under the OR rule
   * (the live attach-PIN path), for devices that support it. The wallet
   * it opens obeys the same Keep-accessible choice, hence the option.
   */
  onAttachPin?: (options?: { keepAccessible: boolean }) => void;
  /**
   * Where the Keep-accessible switch starts, in create mode: the person's
   * remembered choice, which the integration layer keeps in a persisted
   * setting. Read at mount and on each `resetSignal`, never live, so a
   * background settings sync cannot flip the switch mid-entry. Omitted,
   * ON — the first-run default.
   */
  initialKeepAccessible?: boolean;
  /**
   * Protocol V2 entry: UTF-8 measured in bytes, NFKD-normalized before it
   * is handed out, no character rule to show. Off, the printable-ASCII
   * rule and its bullets apply. The driver decides it from the request.
   */
  allowProtocolV2Utf8?: boolean;
  /** One-line inline failure under the rules, mirroring the PIN pad's. */
  error?: string;
  /** Fresh-visit signal, the PIN pad's own: parked presenters bump it
   * per activation to stand in for a remount's clean slate. It fires as
   * the card is LEFT, which is right for clearing the entry (a secret
   * must not linger in a parked form) and wrong for the seed below. */
  resetSignal?: number;
  /**
   * Bumped as the card is ENTERED. The Keep-accessible seed is sampled
   * here, not on `resetSignal`: the exit signal fires before the save of
   * that same exit has broadcast the remembered choice back, so sampling
   * there read the value from before the person's last change.
   */
  activationSignal?: number;
}

/**
 * The passphrase form, per the flow spec: the label row with the
 * switch-to-device action on its trailing edge, masked entry with an eye
 * toggle, the two character-rule bullets (the allowed-characters detail
 * folded into an external link), then Confirm, and — when the device
 * supports it — the attach-PIN alternative under an OR rule.
 */
export function PassphraseForm({
  mode = 'verify',
  onSubmit,
  onSwitchToDevice,
  onAttachPin,
  error,
  initialKeepAccessible,
  allowProtocolV2Utf8,
  resetSignal,
  activationSignal,
}: IPassphraseFormProps) {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const [secure, setSecure] = useState(true);
  // The seed is the person's remembered choice (the integration layer's
  // persisted setting); ON is the first-run default. It is sampled, not
  // bound: a fresh activation reads whatever the preference is then, but
  // a setting that changes while the form is up must not move the switch
  // under the person's hand.
  const seedKeepAccessible = initialKeepAccessible ?? true;
  const seedKeepAccessibleRef = useRef(seedKeepAccessible);
  seedKeepAccessibleRef.current = seedKeepAccessible;
  const [keepAccessible, setKeepAccessible] = useState(seedKeepAccessible);
  const [validationError, setValidationError] = useState<string | undefined>(
    undefined,
  );
  useEffect(() => {
    setValue('');
    setSecure(true);
    setValidationError(undefined);
  }, [resetSignal]);
  useEffect(() => {
    setKeepAccessible(seedKeepAccessibleRef.current);
  }, [activationSignal]);
  const toggleSecure = useCallback(() => setSecure((state) => !state), []);
  // Only create carries the preference out — verify creates nothing, so
  // its exits leave the options absent (the live flow's split).
  const exitOptions = useMemo(
    () => (mode === 'create' ? { keepAccessible } : undefined),
    [keepAccessible, mode],
  );
  const handleChange = useCallback((text: string) => {
    setValue(text);
    setValidationError(undefined);
  }, []);
  const handleConfirm = useCallback(() => {
    // A refused entry speaks its prompt in place of a disabled button —
    // the same ratified grammar as the PIN pad's empty confirm. The
    // rules themselves, and why an empty entry is refused in both
    // modes, live in resolvePassphraseEntryFailure.
    const entryOptions = { allowProtocolV2Utf8 };
    const failure = resolvePassphraseEntryFailure(value, entryOptions);
    if (failure) {
      setValidationError(
        intl.formatMessage({ id: failure.id }, failure.values),
      );
      return;
    }
    onSubmit?.(normalizePassphraseEntry(value, entryOptions), exitOptions);
  }, [allowProtocolV2Utf8, exitOptions, intl, onSubmit, value]);
  const handleSwitchToDevice = useCallback(() => {
    onSwitchToDevice?.(exitOptions);
  }, [exitOptions, onSwitchToDevice]);
  const handleAttachPin = useCallback(() => {
    onAttachPin?.(exitOptions);
  }, [exitOptions, onAttachPin]);
  const addOns = useMemo(
    () => [
      {
        iconName: secure ? ('EyeOutline' as const) : ('EyeOffOutline' as const),
        testID: 'device-stage-passphrase-eye',
        onPress: toggleSecure,
      },
    ],
    [secure, toggleSecure],
  );
  const shownError = validationError ?? error;
  return (
    <YStack gap="$5">
      <YStack gap="$3">
        <YStack gap="$2.5">
          <XStack alignItems="center" justifyContent="space-between">
            <SizableText size="$bodyMdMedium">
              {intl.formatMessage({ id: ETranslations.global_passphrase })}
            </SizableText>
            {onSwitchToDevice ? (
              <Button
                testID="device-stage-passphrase-switch-on-device"
                variant="tertiary"
                size="small"
                icon="SwitchHorOutline"
                onPress={handleSwitchToDevice}
              >
                {intl.formatMessage({
                  id: ETranslations.global_enter_on_device,
                })}
              </Button>
            ) : null}
          </XStack>
          <Input
            testID="device-stage-passphrase-input"
            size="large"
            value={value}
            onChangeText={handleChange}
            secureTextEntry={secure}
            {...passwordManagerIgnoreProps}
            autoCapitalize="none"
            autoCorrect={false}
            addOns={addOns}
          />
        </YStack>
        {/* The character rules as bullets; each dot box matches one text
            line, so the dot centers on the first line and the text owns
            any wrap. */}
        {/* The two bullets state the ASCII rule; a protocol V2 device has
            no character rule to state, so they stay off there — the
            shipped dialog dropped its own description the same way. */}
        {allowProtocolV2Utf8 ? null : (
          <YStack gap="$1">
            <XStack gap="$1" alignItems="flex-start">
              <Stack p="$2">
                <Stack w="$1" h="$1" borderRadius="$full" bg="$textSubdued" />
              </Stack>
              <SizableText flex={1} size="$bodyMd" color="$textSubdued">
                {intl.formatMessage(
                  { id: ETranslations.device_stage_allowed_characters__desc },
                  {
                    link: (chunks: ReactNode[]) => (
                      <Anchor
                        key="link"
                        href="https://www.ascii-code.com/"
                        size="$bodyMd"
                        color="$textSubdued"
                      >
                        {chunks}
                      </Anchor>
                    ),
                  },
                )}
              </SizableText>
            </XStack>
            <XStack gap="$1" alignItems="flex-start">
              <Stack p="$2">
                <Stack w="$1" h="$1" borderRadius="$full" bg="$textSubdued" />
              </Stack>
              <SizableText flex={1} size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.passphrase_character_limit,
                })}
              </SizableText>
            </XStack>
          </YStack>
        )}
        {shownError ? (
          <SizableText size="$bodyMd" color="$textCritical">
            {shownError}
          </SizableText>
        ) : null}
      </YStack>
      {/* The preference stands upstream of every exit on purpose: Confirm
          and the attach-PIN alternative below both carry it out, so it
          reads as "decide what happens to the wallet, then pick a way in".
          Verify unlocks an existing wallet — nothing to decide, no row. */}
      {mode === 'create' ? (
        <PreferenceCapsule
          testID="device-stage-passphrase-keep-accessible"
          label={intl.formatMessage({
            id: ETranslations.device_stage_keep_wallet__title,
          })}
          value={keepAccessible}
          onChange={setKeepAccessible}
        />
      ) : null}
      <Button
        testID="device-stage-passphrase-confirm"
        variant="primary"
        size="large"
        onPress={handleConfirm}
      >
        {intl.formatMessage({ id: ETranslations.global_confirm })}
      </Button>
      {onAttachPin ? (
        <YStack gap="$5">
          {/* Each rule is a sized transparent box carrying a hairline
              bottom border: a box of hairline height alone rounds to
              nothing on native, while a bordered box draws reliably
              (the PIN strip's own hairline). The box height re-centers
              the line on the word. */}
          <XStack gap="$5" alignItems="center">
            <Stack
              flex={1}
              h={2}
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
            />
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_or })}
            </SizableText>
            <Stack
              flex={1}
              h={2}
              borderBottomWidth={StyleSheet.hairlineWidth}
              borderColor="$borderSubdued"
            />
          </XStack>
          <Button
            testID="device-stage-passphrase-attach-pin"
            variant="secondary"
            size="large"
            onPress={handleAttachPin}
          >
            {intl.formatMessage({
              id: ETranslations.global_enter_hidden_wallet_pin,
            })}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}
