import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Haptics,
  Icon,
  Image,
  ImpactFeedbackStyle,
  Page,
  SizableText,
  Toast,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DotMap } from '@onekeyhq/kit/src/components/DotMap';
import { KeyTagInputBoard } from '@onekeyhq/kit/src/components/DotMap/KeyTagInputBoard';
import {
  KEY_TAG_PLATE_ROWS,
  encodeWordToKeyTagRowValue,
  firstKeyTagRowMismatchIndex,
  keyTagRowsMatchTrueValues,
  mismatchedKeyTagRowNumbers,
  toggleKeyTagRowBit,
} from '@onekeyhq/kit/src/components/DotMap/utils';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRecoveryPhraseProtected } from '@onekeyhq/kit/src/hooks/useRecoveryPhraseProtected/useRecoveryPhraseProtected';
import {
  OnboardingHeading,
  OnboardingPage,
  OnboardingSidebar,
} from '@onekeyhq/kit/src/views/Onboardingv2/components/Layout';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes';

import { KeyTagTestIDs } from '../../testIDs';

import type { RouteProp } from '@react-navigation/core';

// Consecutive fully-entered failed Confirms after which we surface the
// "your plate itself may be mispunched" help — a single mistap fails once,
// so repeated full-plate failures point at the steel, not a slip.
const MISPUNCH_HELP_AFTER_FAILS = 3;

const punchGuide = [
  {
    titleId: ETranslations.keytag_punch_how__title,
    descId: ETranslations.keytag_punch_how__desc,
  },
  {
    titleId: ETranslations.keytag_punch_check__title,
    descId: ETranslations.keytag_punch_check__desc,
  },
] as const;

type IPhase = 'review' | 'verify' | 'success';

const BackupDotMap = () => {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const route =
    useRoute<
      RouteProp<IOnboardingParamListV2, EOnboardingPagesV2.KeyTagBackupDotMap>
    >();

  useEffect(() => {
    defaultLogger.setting.page.keyTagBackup();
  }, []);

  const { encodedText, title, wallet } = route.params;
  const { result } = usePromiseResult(
    () =>
      backgroundApiProxy.servicePassword.decodeSensitiveText({ encodedText }),
    [encodedText],
  );
  // The dot map is seed-equivalent; block screenshots/recording while shown.
  useRecoveryPhraseProtected({ enabled: Boolean(result) });
  // Punching (and re-entering) 12-24 rows is a minutes-long, hands-on-steel
  // task with the phone propped up and untouched; without this the OS
  // auto-locks mid-row. Mirrors the app's other long-run flows.
  useKeepAwake();
  const appNavigation = useAppNavigation();

  // The wallet's real per-row values, the source of truth for verification.
  const words = useMemo(
    () => (result ? result.trim().replace(/\s+/g, ' ').split(' ') : []),
    [result],
  );
  const trueValues = useMemo(
    () => words.map((word) => encodeWordToKeyTagRowValue(word)),
    [words],
  );
  const wordCount = words.length;
  const isMultiPlate = wordCount > KEY_TAG_PLATE_ROWS;
  // Re-viewing an already-backed-up wallet has nothing to verify; stay on the
  // read-only map with a plain Done. Everything else (a wallet not yet backed
  // up, or the no-wallet "enter phrase" branch) runs review -> verify.
  const alreadyBackedUp = Boolean(wallet?.id && wallet.backuped);
  const showVerifyFlow = Boolean(result) && !alreadyBackedUp;

  const [phase, setPhase] = useState<IPhase>('review');
  // Which face of the plate is showing when the phrase spans both sides.
  const [side, setSide] = useState<'front' | 'back'>('front');
  // Verify input (blank re-entry from the physical plate).
  const [rows, setRows] = useState<number[]>([]);
  const [touchedMask, setTouchedMask] = useState<boolean[]>([]);
  // Red on the mismatched/empty rows; cleared on any toggle so edits show.
  // The which-rows message is a Toast (see handleVerifyConfirm), not inline.
  const [flagged, setFlagged] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const mismatchMask = useMemo(
    () =>
      flagged
        ? rows.map((value, index) => value !== trueValues[index])
        : undefined,
    [flagged, rows, trueValues],
  );
  // On the first face while more remain, the primary is "Flip to back"; on the
  // last face a secondary "Flip to front" sits beside the primary.
  const showNextAction = isMultiPlate && side === 'front';
  const showFlipBack = isMultiPlate && side === 'back';

  const handleFlipToBack = useCallback(() => setSide('back'), []);
  const handleFlipToFront = useCallback(() => setSide('front'), []);

  const handleToggleHole = useCallback(
    (rowIndex: number, holeIndex: number) => {
      Haptics.impact(ImpactFeedbackStyle.Light);
      setRows((prev) =>
        prev.map((value, index) =>
          index === rowIndex ? toggleKeyTagRowBit(value, holeIndex) : value,
        ),
      );
      setTouchedMask((prev) =>
        prev[rowIndex]
          ? prev
          : prev.map((t, index) => (index === rowIndex ? true : t)),
      );
      // Clear the red cells so the user sees their edit.
      setFlagged(false);
    },
    [],
  );

  const handleEnterVerify = useCallback(() => {
    if (!wordCount) {
      return;
    }
    // Blank plate: the true dots are unmounted and rows reset to zero, so the
    // only faithful copy on hand is the punched steel.
    setRows(Array.from({ length: wordCount }, () => 0));
    setTouchedMask(Array.from({ length: wordCount }, () => false));
    setSide('front');
    setFlagged(false);
    setFailCount(0);
    setPhase('verify');
  }, [wordCount]);

  // Non-verify exit: re-viewing an already-backed-up wallet, or a wallet that
  // for some reason isn't KeyTag-verifiable. Marks backed up only if pending.
  const handleReviewDone = useCallback(async () => {
    if (wallet?.id && !wallet.backuped) {
      await backgroundApiProxy.serviceAccount.updateWalletBackupStatus({
        walletId: wallet.id,
        isBackedUp: true,
      });
    }
    appNavigation.popStack();
  }, [appNavigation, wallet]);

  const handleSuccessDone = useCallback(
    () => appNavigation.popStack(),
    [appNavigation],
  );

  const showMispunchHelp = useCallback(() => {
    Dialog.show({
      icon: 'ErrorOutline',
      tone: 'destructive',
      title: intl.formatMessage({
        id: ETranslations.keytag_verify_help__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.keytag_verify_help__desc,
      }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.keytag_verify_help_recheck__action,
      }),
    });
  }, [intl]);

  const handleVerifyConfirm = useCallback(async () => {
    if (submitting) {
      return;
    }
    if (!keyTagRowsMatchTrueValues(rows, trueValues)) {
      setFlagged(true);
      const bad = firstKeyTagRowMismatchIndex(rows, trueValues);
      if (bad >= 0) {
        setSide(bad < KEY_TAG_PLATE_ROWS ? 'front' : 'back');
      }
      Toast.error({
        title: intl.formatMessage(
          { id: ETranslations.keytag_verify_mismatch__msg },
          { rows: mismatchedKeyTagRowNumbers(rows, trueValues).join(', ') },
        ),
      });
      // A single mistap fails once; three full-plate failures in a row point at
      // a genuinely mispunched plate, so offer the spare-tag help.
      const fullyEntered =
        rows.length > 0 && rows.every((value) => value !== 0);
      const nextFail = fullyEntered ? failCount + 1 : 0;
      setFailCount(nextFail);
      if (nextFail === MISPUNCH_HELP_AFTER_FAILS) {
        showMispunchHelp();
      }
      return;
    }
    setSubmitting(true);
    try {
      // No wallet (enter-phrase branch): verification still runs, it just marks
      // nothing. updateWalletBackupStatus already emits WalletUpdate + analytics.
      if (wallet?.id && !wallet.backuped) {
        await backgroundApiProxy.serviceAccount.updateWalletBackupStatus({
          walletId: wallet.id,
          isBackedUp: true,
        });
      }
      setFlagged(false);
      setPhase('success');
    } catch {
      // updateWalletBackupStatus is @toastIfError, so the failure toast is
      // already raised; stay on verify (do NOT advance) so the user can retry.
    } finally {
      setSubmitting(false);
    }
  }, [submitting, rows, trueValues, failCount, intl, showMispunchHelp, wallet]);

  // How-to-punch guidance (review phase only).
  const guidance = useMemo(
    () => (
      <YStack gap="$6">
        {punchGuide.map((item) => (
          <YStack key={item.titleId} gap="$1">
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({ id: item.titleId })}
            </SizableText>
            <SizableText size="$bodyLg" color="$textSubdued">
              {intl.formatMessage({ id: item.descId })}
            </SizableText>
          </YStack>
        ))}
      </YStack>
    ),
    [intl],
  );

  const doneLabel = intl.formatMessage({ id: ETranslations.global_done });
  const confirmLabel = intl.formatMessage({ id: ETranslations.global_confirm });
  const nextLabel = intl.formatMessage({
    id: ETranslations.keytag_flip_to_back__action,
  });
  const flipToFrontLabel = intl.formatMessage({
    id: ETranslations.keytag_flip_to_front__action,
  });

  // --- success phase: a calm confirmation, no plate --------------------------
  if (phase === 'success') {
    return (
      <OnboardingPage headerTitle={title} showLanguageSelector={false}>
        <YStack flex={1} jc="center" ai="center" gap="$8" px="$5">
          <Icon name="CheckRadioSolid" size="$16" color="$iconSuccess" />
          <YStack gap="$2" ai="center" maxWidth={360}>
            <SizableText size="$heading2xl" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.keytag_verify_success__title,
              })}
            </SizableText>
            <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
              {intl.formatMessage({
                id: ETranslations.keytag_verify_success__desc,
              })}
            </SizableText>
          </YStack>
          <Button
            size="large"
            variant="primary"
            onPress={handleSuccessDone}
            testID={KeyTagTestIDs.verifyDoneBtn}
          >
            {doneLabel}
          </Button>
        </YStack>
      </OnboardingPage>
    );
  }

  const isVerify = phase === 'verify';

  // The final-face primary action depends on the phase.
  let primaryLabel = doneLabel;
  let primaryOnPress: () => void = handleReviewDone;
  let primaryTestID: string = KeyTagTestIDs.gotItBtn;
  let primaryLoading = false;
  let primaryDisabled = false;
  if (isVerify) {
    primaryLabel = confirmLabel;
    primaryOnPress = handleVerifyConfirm;
    primaryTestID = KeyTagTestIDs.verifyConfirmBtn;
    primaryLoading = submitting;
    primaryDisabled = submitting;
  } else if (showVerifyFlow) {
    primaryLabel = intl.formatMessage({
      id: ETranslations.keytag_verify_start__action,
    });
    primaryOnPress = handleEnterVerify;
    primaryTestID = KeyTagTestIDs.verifyStartBtn;
    primaryDisabled = !result;
  }

  const primaryButton = (
    <Button
      flexGrow={1}
      flexBasis={0}
      size="large"
      variant="primary"
      disabled={primaryDisabled}
      loading={primaryLoading}
      onPress={primaryOnPress}
      testID={primaryTestID}
    >
      {primaryLabel}
    </Button>
  );
  const nextButton = (
    <Button
      flexGrow={1}
      flexBasis={0}
      size="large"
      variant="primary"
      icon="RotateAxisOutline"
      onPress={handleFlipToBack}
      testID={KeyTagTestIDs.backupFlipNextBtn}
    >
      {nextLabel}
    </Button>
  );
  const flipBackButton = (
    <Button
      flexGrow={1}
      flexBasis={0}
      size="large"
      variant="secondary"
      icon="RotateAxisOutline"
      onPress={handleFlipToFront}
      testID={KeyTagTestIDs.backupFlipBackBtn}
    >
      {flipToFrontLabel}
    </Button>
  );

  // Right column (gtMd) / below-plate (mobile): review shows how-to-punch
  // guidance, verify shows its one-line "read the steel" instruction.
  const sideContent = isVerify ? (
    <>
      {/* same flat plate shot the interactive import page uses, since verify is
          the same re-entry interaction */}
      <Image
        width={56}
        height={56}
        alignSelf="flex-start"
        mb="$8"
        source={require('@onekeyhq/kit/assets/keytag/keytag_plate.png')}
      />
      <SizableText size="$bodyLg" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.keytag_verify__desc })}
      </SizableText>
    </>
  ) : (
    <>
      {/* product shot of the physical KeyTag plate, in the badge slot */}
      <Image
        width={56}
        height={56}
        alignSelf="flex-start"
        mb="$8"
        source={require('@onekeyhq/kit/assets/keytag/keytag_product.png')}
      />
      {guidance}
    </>
  );

  const verifyPlate = (
    <KeyTagInputBoard
      rows={rows}
      touchedMask={touchedMask}
      side={side}
      flagIncomplete={flagged}
      mismatchMask={mismatchMask}
      onToggleHole={handleToggleHole}
    />
  );

  return (
    <OnboardingPage headerTitle={title} showLanguageSelector={false} scrollable>
      <YStack $gtMd={{ flexDirection: 'row' }}>
        <YStack gap="$8" $gtMd={{ flex: 1, gap: '$12' }}>
          <OnboardingHeading>
            {intl.formatMessage({
              id: isVerify
                ? ETranslations.keytag_verify__title
                : ETranslations.keytag_backup_short__title,
            })}
          </OnboardingHeading>
          <YStack gap="$5" pb="$5">
            {isVerify ? verifyPlate : null}
            {!isVerify && result ? (
              <DotMap mnemonic={result} side={side} />
            ) : null}
            {gtMd ? (
              <XStack gap="$3" alignSelf="stretch">
                {showFlipBack ? flipBackButton : null}
                {showNextAction ? nextButton : primaryButton}
              </XStack>
            ) : null}
          </YStack>
        </YStack>
        {/* right column (gtMd) / below (mobile): verify keeps the same left+right
            layout, with its instruction where review's guidance sits. */}
        {gtMd ? (
          <OnboardingSidebar>{sideContent}</OnboardingSidebar>
        ) : (
          <YStack mt="$4">{sideContent}</YStack>
        )}
      </YStack>

      {!gtMd ? (
        <Page.Footer>
          <Page.FooterActions
            pb={safeAreaBottom ? safeAreaBottom + 8 : 20}
            onConfirmText={showNextAction ? nextLabel : primaryLabel}
            confirmButtonProps={
              showNextAction
                ? {
                    testID: KeyTagTestIDs.backupFlipNextBtn,
                    icon: 'RotateAxisOutline',
                    onPress: handleFlipToBack,
                  }
                : {
                    testID: primaryTestID,
                    variant: 'primary',
                    disabled: primaryDisabled,
                    loading: primaryLoading,
                    onPress: primaryOnPress,
                  }
            }
            {...(showFlipBack
              ? {
                  onCancelText: flipToFrontLabel,
                  // 1-arg handler so FooterActions does not auto-pop the page.
                  onCancel: (_close: () => void) => setSide('front'),
                  cancelButtonProps: {
                    icon: 'RotateAxisOutline',
                    testID: KeyTagTestIDs.backupFlipBackBtn,
                  },
                }
              : {})}
          />
        </Page.Footer>
      ) : null}
    </OnboardingPage>
  );
};

export default BackupDotMap;
