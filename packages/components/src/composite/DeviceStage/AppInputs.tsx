import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

import { Alert } from '../../actions/Alert';
import { IconButton } from '../../actions/IconButton';
import { Popover } from '../../actions/Popover';
import { MARK_IN_MS, easeOutFn } from '../../content/deviceScene';
import { Input } from '../../forms/Input';
import { ESwitchSize, Switch } from '../../forms/Switch';
import {
  Anchor,
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '../../primitives';

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

type IPinKeyValue = (typeof PIN_KEY_ROWS)[number][number];

const KEY_HOVER = { bg: '$bgStrongHover' } as const;
const KEY_PRESS = { bg: '$bgStrongActive' } as const;
const KEY_FOCUS = {
  outlineColor: '$focusRing',
  outlineOffset: -2,
  outlineWidth: 2,
  outlineStyle: 'solid',
} as const;

/** The strip's resting face: the spec's fixed black-alpha overlay — the
 * one surface here darker than the stage, marking it as output. */
const STRIP_BG = 'rgba(0,0,0,0.3)';

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

/** Refusing an empty confirm: a prompt in place of a disabled key. */
const EMPTY_PIN_PROMPT = 'Enter your PIN first.';

function PinKey({
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
}

export interface IPinPadProps {
  onSubmit?: (pin: string) => void;
  onSwitchToDevice?: () => void;
  /**
   * One-line inline failure that takes over the strip — the retry-in-place
   * state. Its arrival clears the typed value: the previous entry was
   * consumed and refused. It steps aside again on the first new keypress.
   */
  error?: string;
}

export function PinPad({ onSubmit, onSwitchToDevice, error }: IPinPadProps) {
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
  const shownError =
    externalError ?? (emptyPrompt ? EMPTY_PIN_PROMPT : undefined);
  return (
    <YStack gap="$2">
      <YStack
        px="$4"
        py="$4"
        borderRadius="$4"
        borderCurve="continuous"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor={shownError ? '$borderCritical' : '$borderSubdued'}
        bg={shownError ? '$bgCriticalSubdued' : STRIP_BG}
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
                Match the number positions on your device
              </SizableText>
            ) : null}
          </XStack>
        </Animated.View>
      </YStack>
      {PIN_KEY_ROWS.map((row) => (
        <XStack key={row[0]} gap="$2">
          {row.map((key) => (
            <PinKey key={key} value={key} onKey={handleKey} />
          ))}
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
            Enter on device
          </SizableText>
        </XStack>
      ) : null}
    </YStack>
  );
}

/** The device accepts printable ASCII only (production's validation). */
const PASSPHRASE_MAX_LENGTH = 50;
// eslint-disable-next-line no-control-regex
const PASSPHRASE_CHARSET = /^[\x20-\x7E]*$/;

/* The allowed-characters popover, hoisted whole: every piece is static. */
const PASSPHRASE_INFO_PANEL_PROPS = { width: '$80' } as const;
const PASSPHRASE_INFO_TRIGGER = (
  <IconButton
    testID="device-stage-passphrase-info"
    variant="tertiary"
    size="small"
    icon="InfoCircleOutline"
  />
);
function renderPassphraseInfoContent() {
  return (
    <Stack p="$5">
      <Anchor
        href="https://www.ascii-code.com/"
        size="$bodyMd"
        color="$textInfo"
      >
        Letters, numbers &amp; symbols (ASCII 32-126)
      </Anchor>
    </Stack>
  );
}

export interface IPassphraseFormProps {
  /**
   * The live form's two shapes. 'create' is the Add-hidden-wallet form:
   * Keep-accessible switch shown, empty entry disabled. 'verify' unlocks
   * an existing hidden wallet: no switch, and empty stays submittable —
   * it is the standard wallet, and the SDK's passphrase-state check
   * refuses a wrong entry.
   */
  mode?: 'create' | 'verify';
  onSubmit?: (passphrase: string, options: { keepAccessible: boolean }) => void;
  onSwitchToDevice?: () => void;
  /**
   * Shows the secondary "Enter Hidden Wallet PIN" action (the live
   * form's attach-PIN path), for devices that support it.
   */
  onAttachPin?: () => void;
  /** One-line inline failure under the field, mirroring the PIN pad's. */
  error?: string;
}

/**
 * The passphrase form, element-for-element the live EnterPhase: the loss
 * warning, the Enter-on-device label addon, masked entry with an eye
 * toggle, the Max-50 line with the allowed-characters popover, the
 * Keep-accessible switch (create), and the attach-PIN secondary action.
 * All copy is the live form's English, verbatim — the stage restyles the
 * container, never the furniture.
 */
export function PassphraseForm({
  mode = 'create',
  onSubmit,
  onSwitchToDevice,
  onAttachPin,
  error,
}: IPassphraseFormProps) {
  const [value, setValue] = useState('');
  const [secure, setSecure] = useState(true);
  const [keepAccessible, setKeepAccessible] = useState(false);
  const [validationError, setValidationError] = useState<string | undefined>(
    undefined,
  );
  const toggleSecure = useCallback(() => setSecure((state) => !state), []);
  const handleChange = useCallback((text: string) => {
    setValue(text);
    setValidationError(undefined);
  }, []);
  const handleConfirm = useCallback(() => {
    if (value.length > PASSPHRASE_MAX_LENGTH) {
      setValidationError('passphrase supports a maximum of 50 characters');
      return;
    }
    if (!PASSPHRASE_CHARSET.test(value)) {
      setValidationError('Contains unsupported characters');
      return;
    }
    onSubmit?.(value, { keepAccessible });
  }, [keepAccessible, onSubmit, value]);
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
  const confirmDisabled = mode === 'create' && value.length === 0;
  return (
    <YStack gap="$5">
      <Alert type="warning" title="Passphrase is unrecoverable if lost" />
      <YStack gap="$2">
        <XStack alignItems="center" justifyContent="space-between">
          <SizableText size="$bodyMdMedium">Passphrase</SizableText>
          {onSwitchToDevice ? (
            <Button
              testID="device-stage-passphrase-switch-on-device"
              variant="tertiary"
              size="small"
              icon="OnekeyDeviceCustom"
              onPress={onSwitchToDevice}
            >
              Enter on device
            </Button>
          ) : null}
        </XStack>
        <Input
          testID="device-stage-passphrase-input"
          value={value}
          onChangeText={handleChange}
          placeholder="Enter passphrase"
          secureTextEntry={secure}
          autoCapitalize="none"
          autoCorrect={false}
          addOns={addOns}
        />
        <XStack gap="$1" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            Max 50 characters
          </SizableText>
          <Popover
            placement="bottom"
            title="Allowed characters"
            floatingPanelProps={PASSPHRASE_INFO_PANEL_PROPS}
            renderTrigger={PASSPHRASE_INFO_TRIGGER}
            renderContent={renderPassphraseInfoContent}
          />
        </XStack>
        {shownError ? (
          <SizableText size="$bodyMd" color="$textCritical">
            {shownError}
          </SizableText>
        ) : null}
      </YStack>
      {mode === 'create' ? (
        <XStack alignItems="center" justifyContent="space-between" gap="$4">
          <SizableText flex={1} size="$bodyMd" color="$textSubdued">
            <SizableText size="$bodyMdMedium" color="$text">
              Keep accessible
            </SizableText>
            . Hidden wallets stay after you close the app
          </SizableText>
          <Switch
            testID="device-stage-passphrase-keep-accessible"
            size={ESwitchSize.small}
            value={keepAccessible}
            onChange={setKeepAccessible}
          />
        </XStack>
      ) : null}
      <YStack gap="$2.5">
        <Button
          testID="device-stage-passphrase-confirm"
          variant="primary"
          disabled={confirmDisabled}
          onPress={handleConfirm}
        >
          Confirm
        </Button>
        {onAttachPin ? (
          <Button
            testID="device-stage-passphrase-attach-pin"
            variant="secondary"
            onPress={onAttachPin}
          >
            Enter Hidden Wallet PIN
          </Button>
        ) : null}
      </YStack>
    </YStack>
  );
}
