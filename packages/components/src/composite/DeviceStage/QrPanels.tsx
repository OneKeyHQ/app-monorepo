import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { QRCode } from '../../content/QRCode';
import {
  Button,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '../../primitives';

/**
 * The air-gap panels: the two steps where the channel is light, not a
 * cable — the app shows a code for the device to scan, then the app's
 * camera scans the code the device shows back. The person is holding the
 * device in both, so no replica is on stage (the same reasoning as the
 * app-side inputs). Multi-part rotating codes for large payloads are an
 * integration-layer concern inside these panels, not extra steps.
 *
 * The app is blind to everything that happens on the device side — that
 * is the air gap — so the words carry the device-side steps as a static
 * numbered pair (never a checklist: nothing here can verify a step). The
 * wording follows the live toast's: the device VERIFIES the details and
 * then shows its answer code — there is no device-side approve, so the
 * steps must not invent one. Step 2 carries the advance condition
 * ("return when the code shows"), which is what gates a premature Next.
 */

/** Code size inside its white quiet-zone card. */
const QR_SIZE = 216;
const QR_QUIET_ZONE = 12;

/** The camera window's square, matched to the code card's footprint. */
const FRAME_SIZE = QR_SIZE + 2 * QR_QUIET_ZONE;
const CORNER_SIZE = 26;
const CORNER_WIDTH = 3;
const CORNER_INSET = 10;
const CORNER_COLOR = 'rgba(255,255,255,0.5)';

function QrStep({ index, text }: { index: number; text: string }) {
  return (
    <XStack gap="$1.5">
      <SizableText size="$bodySm" color="$textSubdued">
        {index}.
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued" flex={1}>
        {text}
      </SizableText>
    </XStack>
  );
}

export function QrPresent({
  value,
  onNext,
}: {
  value?: string;
  onNext?: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$5">
      <YStack alignItems="center" py="$2">
        {/* White card: the quiet zone a dark stage cannot provide — the
          device camera needs the contrast to lock on. */}
        <YStack
          p={QR_QUIET_ZONE}
          bg="#FFFFFF"
          borderRadius="$4"
          borderCurve="continuous"
        >
          <QRCode value={value} size={QR_SIZE} />
        </YStack>
      </YStack>
      {onNext ? (
        // The manual handoff an air-gapped flow cannot make on its own:
        // nothing tells the app when the device has finished, so only the
        // person — watching the device show its answer code — can move
        // the flow forward. Absent onNext (a one-way broadcast, nothing
        // to scan back), there is no button.
        <YStack gap="$4">
          <YStack gap="$1.5">
            <QrStep
              index={1}
              text={intl.formatMessage({
                id: ETranslations.scan_qr_code_to_verify_details,
              })}
            />
            <QrStep
              index={2}
              text={intl.formatMessage({
                id: ETranslations.secure_qr_toast_scan_qr_code_on_device_text,
              })}
            />
          </YStack>
          <Button
            testID="device-stage-qr-next"
            variant="primary"
            onPress={onNext}
          >
            {intl.formatMessage({ id: ETranslations.global_next })}
          </Button>
        </YStack>
      ) : null}
    </YStack>
  );
}

/**
 * A visual stand-in for the camera: the integration layer mounts the real
 * preview inside this window; the stage only fixes where the window sits
 * and how it is framed.
 */
export function QrScanFrame({ onBack }: { onBack?: () => void }) {
  const intl = useIntl();
  return (
    <YStack alignItems="center" py="$2">
      <YStack
        width={FRAME_SIZE}
        height={FRAME_SIZE}
        borderRadius="$4"
        borderCurve="continuous"
        bg="rgba(255,255,255,0.04)"
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="CameraOutline" size="$8" color="$iconSubdued" />
        <Stack
          position="absolute"
          top={CORNER_INSET}
          left={CORNER_INSET}
          width={CORNER_SIZE}
          height={CORNER_SIZE}
          borderTopWidth={CORNER_WIDTH}
          borderLeftWidth={CORNER_WIDTH}
          borderColor={CORNER_COLOR}
          borderTopLeftRadius="$2"
          borderCurve="continuous"
        />
        <Stack
          position="absolute"
          top={CORNER_INSET}
          right={CORNER_INSET}
          width={CORNER_SIZE}
          height={CORNER_SIZE}
          borderTopWidth={CORNER_WIDTH}
          borderRightWidth={CORNER_WIDTH}
          borderColor={CORNER_COLOR}
          borderTopRightRadius="$2"
          borderCurve="continuous"
        />
        <Stack
          position="absolute"
          bottom={CORNER_INSET}
          left={CORNER_INSET}
          width={CORNER_SIZE}
          height={CORNER_SIZE}
          borderBottomWidth={CORNER_WIDTH}
          borderLeftWidth={CORNER_WIDTH}
          borderColor={CORNER_COLOR}
          borderBottomLeftRadius="$2"
          borderCurve="continuous"
        />
        <Stack
          position="absolute"
          bottom={CORNER_INSET}
          right={CORNER_INSET}
          width={CORNER_SIZE}
          height={CORNER_SIZE}
          borderBottomWidth={CORNER_WIDTH}
          borderRightWidth={CORNER_WIDTH}
          borderColor={CORNER_COLOR}
          borderBottomRightRadius="$2"
          borderCurve="continuous"
        />
      </YStack>
      <SizableText size="$bodySm" color="$textSubdued" mt="$2.5">
        Camera preview mounts here.
      </SizableText>
      {onBack ? (
        // The escape hatch for a premature handoff: the code left the
        // screen the moment the person advanced, so if the device never
        // got it, this is the only way out that is not a full cancel.
        // Secondary, not tertiary: a bare grey line here reads as another
        // caption, and an escape hatch nobody recognizes is not one.
        <Button
          testID="device-stage-qr-back"
          variant="secondary"
          size="small"
          mt="$4"
          onPress={onBack}
        >
          {intl.formatMessage({
            id: ETranslations.device_stage_show_code_again__action,
          })}
        </Button>
      ) : null}
    </YStack>
  );
}
