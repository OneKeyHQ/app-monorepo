import { useEffect, useRef } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';
import {
  CaptureEventType,
  CaptureProtection,
} from 'react-native-capture-protection';

import { Dialog, Icon, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

type IRecoveryPhraseProtectedDialogType =
  | 'recoveryPhrase'
  | 'sensitiveInformation';

type IUseRecoveryPhraseProtectedOptions = {
  dialogType?: IRecoveryPhraseProtectedDialogType;
  enabled?: boolean;
};

const showRecoveryPhraseProtectedDialog = (
  intl: IntlShape,
  dialogType: IRecoveryPhraseProtectedDialogType,
) => {
  const isRecoveryPhrase = dialogType === 'recoveryPhrase';
  Dialog.confirm({
    title: intl.formatMessage({
      id: isRecoveryPhrase
        ? ETranslations.recovery_phrase_screenshot_protected_title
        : ETranslations.sensitive_information_screenshot_protected__title,
    }),
    description: intl.formatMessage(
      {
        id: isRecoveryPhrase
          ? ETranslations.recovery_phrase_screenshot_protected_desc
          : ETranslations.sensitive_information_screenshot_protected__desc,
      },
      {
        tag: (chunks) =>
          (
            <SizableText color="$textCritical" size="$bodyLgMedium">
              {chunks}
            </SizableText>
          ) as unknown as string,
      },
    ),
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_got_it,
    }),
    renderContent: (
      <YStack
        bg="$bgSubdued"
        borderColor="$borderSubdued"
        borderWidth="$px"
        borderRadius="$3"
        py="$5"
        ai="center"
        jc="center"
      >
        <Icon
          name="ImageWaveSolid"
          size="$6"
          color="$iconDisabled"
          position="absolute"
          top="$2"
          right="$2"
        />
        <YStack
          w={120}
          h={228}
          borderColor="$neutral3"
          borderWidth={3}
          borderRadius="$4"
          shadowColor="rgba(0, 0, 0, 0.1)"
          shadowOffset={{ width: 0, height: 2 }}
          shadowOpacity={1}
          shadowRadius={4}
          elevation={2}
          overflow="hidden"
        >
          <YStack
            flex={1}
            p="$3"
            pb={5}
            borderWidth={1}
            borderRadius="$3"
            overflow="hidden"
            borderColor="$border"
            justifyContent="flex-end"
            alignItems="center"
            bg="rgba(0, 0, 0, 0.9)"
          >
            <Stack
              h="$1"
              w={50}
              bg="rgba(255, 255, 255, 0.95)"
              borderRadius={14}
            />
          </YStack>
        </YStack>
      </YStack>
    ),
  });
};

// CaptureProtection is a process-wide native singleton while its React consumers
// nest: pushing KeyTagBackupDotMap on top of the enter-phrase page keeps that
// page (and its PhaseInputArea) mounted underneath, so two consumers are live at
// once. Everything below the hook is therefore module-level and ref-counted —
// the native prevent/allow pair, the capture listener, and the warning dialog's
// timer/debounce. Per-consumer listeners would each fire on one screenshot and
// stack a dialog per mounted consumer.
type IProtectionConsumer = {
  // Reads the owning hook's latest intl + dialogType through a ref, so the
  // registry never has to re-register when either changes.
  show: () => void;
};

let consumers: IProtectionConsumer[] = [];
let captureListener: { remove: () => void } | undefined;
let showTimer: ReturnType<typeof setTimeout> | undefined;

// The topmost consumer is the last one mounted, and it owns the screen the user
// is actually looking at — so its copy (recoveryPhrase vs sensitiveInformation)
// is the one to show.
const debouncedShow = debounce(() => {
  consumers[consumers.length - 1]?.show();
}, 350);

const handleCaptureEvent = (eventType: CaptureEventType) => {
  if (
    eventType !== CaptureEventType.CAPTURED &&
    eventType !== CaptureEventType.RECORDING
  ) {
    return;
  }
  if (showTimer) {
    clearTimeout(showTimer);
  }
  showTimer = setTimeout(() => {
    debouncedShow();
  }, 350);
};

const registerConsumer = (consumer: IProtectionConsumer) => {
  consumers.push(consumer);
  if (consumers.length === 1) {
    void CaptureProtection.prevent();
    captureListener = CaptureProtection.addListener(handleCaptureEvent);
  }
};

const unregisterConsumer = (consumer: IProtectionConsumer) => {
  consumers = consumers.filter((item) => item !== consumer);
  if (consumers.length > 0) {
    return;
  }
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = undefined;
  }
  debouncedShow.cancel();
  void CaptureProtection.allow();
  captureListener?.remove();
  captureListener = undefined;
};

export const useRecoveryPhraseProtected = ({
  dialogType = 'recoveryPhrase',
  enabled = true,
}: IUseRecoveryPhraseProtectedOptions = {}) => {
  const intl = useIntl();
  // Held in a ref so a new intl identity or a changed dialogType never churns
  // the registration — re-registering would momentarily drop the count to zero
  // and release protection while the phrase is still on screen.
  const showRef = useRef<() => void>(() => {});
  showRef.current = () => showRecoveryPhraseProtectedDialog(intl, dialogType);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const consumer: IProtectionConsumer = { show: () => showRef.current() };
    registerConsumer(consumer);
    return () => unregisterConsumer(consumer);
  }, [enabled]);
};
