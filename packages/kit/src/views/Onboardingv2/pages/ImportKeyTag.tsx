import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useKeepAwake } from 'expo-keep-awake';
import { useIntl } from 'react-intl';

import {
  Anchor,
  Button,
  Dialog,
  Haptics,
  Image,
  ImpactFeedbackStyle,
  Page,
  Select,
  SizableText,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { KeyTagInputBoard } from '@onekeyhq/kit/src/components/DotMap/KeyTagInputBoard';
import {
  KEY_TAG_PLATE_ROWS,
  KEY_TAG_WORD_COUNTS,
  canSubmitKeyTagRows,
  firstNonVerifiedKeyTagRowIndex,
  keyTagRowsShrinkDiscardsInput,
  keyTagRowsToMnemonic,
  resizeKeyTagRows,
  toggleKeyTagRowBit,
} from '@onekeyhq/kit/src/components/DotMap/utils';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useRecoveryPhraseProtected } from '@onekeyhq/kit/src/hooks/useRecoveryPhraseProtected/useRecoveryPhraseProtected';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import {
  OnboardingHeading,
  OnboardingPage,
  OnboardingSidebar,
} from '../components/Layout';
import { OnboardingTestIDs } from '../testIDs';

const KEYTAG_PRODUCT_URL = 'https://onekey.so/products/onekey-keytag/';

// gtMd sidebar Q&A, mirroring ImportPhraseOrPrivateKey's layout.
const sidebarFaqs = [
  {
    titleId: ETranslations.keytag_import_what__title,
    descriptionId: ETranslations.keytag_import_what__desc,
  },
  {
    titleId: ETranslations.keytag_import_how__title,
    descriptionId: ETranslations.keytag_import_how__desc,
  },
];

export function ImportKeyTag() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const reactNavigation = useNavigation();
  const { gtMd } = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();

  const [wordCount, setWordCount] = useState<number>(12);
  const [rows, setRows] = useState<number[]>(() =>
    Array.from({ length: 12 }, () => 0),
  );
  const [touchedMask, setTouchedMask] = useState<boolean[]>(() =>
    Array.from({ length: 12 }, () => false),
  );
  // Set after pressing Confirm while the grid is incomplete — flags the rows
  // still missing a valid word in red, instead of a dead disabled button.
  const [flagIncomplete, setFlagIncomplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Which face of the plate is showing when the mnemonic spans two plates
  // (>12 words). 12-word imports never leave the front.
  const [side, setSide] = useState<'front' | 'back'>('front');
  const allowLeaveRef = useRef(false);

  const dirty = useMemo(() => rows.some((value) => value !== 0), [rows]);
  const canSubmit = useMemo(() => canSubmitKeyTagRows(rows), [rows]);

  useRecoveryPhraseProtected({ enabled: dirty });
  // Mirroring a punched plate is a slow, look-away-often task; hold the screen
  // awake so a long pause reading the steel does not drop the session.
  useKeepAwake();

  const handleToggleHole = useCallback(
    (rowIndex: number, holeIndex: number) => {
      // A crisp tick per committed toggle: with sub-44pt cells an overshoot
      // hits the neighbour instead of missing, so confirming each registered
      // bit by feel is the cheapest guard against a silent wrong punch.
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
      setFlagIncomplete(false);
    },
    [],
  );

  const handleFlipToBack = useCallback(() => setSide('back'), []);
  const handleFlipToFront = useCallback(() => setSide('front'), []);

  const handleWordCountChange = useCallback(
    (nextCountValue: string | number) => {
      const nextCount = Number(nextCountValue);
      if (!nextCount || nextCount === rows.length) {
        return;
      }
      const applyResize = () => {
        setWordCount(nextCount);
        setRows((prev) => resizeKeyTagRows(prev, nextCount));
        setTouchedMask((prev) => {
          if (nextCount <= prev.length) {
            return prev.slice(0, nextCount);
          }
          return prev.concat(new Array(nextCount - prev.length).fill(false));
        });
        setSide('front');
        setFlagIncomplete(false);
      };
      if (keyTagRowsShrinkDiscardsInput(rows, nextCount)) {
        Dialog.show({
          icon: 'ErrorOutline',
          tone: 'destructive',
          title: intl.formatMessage({
            id: ETranslations.keytag_shrink_confirm__title,
          }),
          description: intl.formatMessage(
            { id: ETranslations.keytag_shrink_confirm__desc },
            { from: nextCount + 1, to: rows.length },
          ),
          onConfirmText: intl.formatMessage({
            id: ETranslations.global_confirm,
          }),
          onConfirm: applyResize,
        });
        return;
      }
      applyResize();
    },
    [intl, rows],
  );

  // Leaving with punched holes discards them (input is intentionally not
  // persisted); ask first. Successful submits disable the guard.
  useEffect(() => {
    const unsubscribe = reactNavigation.addListener('beforeRemove', (e) => {
      if (allowLeaveRef.current) {
        return;
      }
      let isDirty = false;
      setRows((currentRows) => {
        isDirty = currentRows.some((value) => value !== 0);
        return currentRows;
      });
      if (!isDirty) {
        return;
      }
      e.preventDefault();
      Dialog.show({
        icon: 'ErrorOutline',
        tone: 'destructive',
        title: intl.formatMessage({
          id: ETranslations.keytag_leave_confirm__title,
        }),
        description: intl.formatMessage({
          id: ETranslations.keytag_leave_confirm__desc,
        }),
        onConfirmText: intl.formatMessage({ id: ETranslations.global_confirm }),
        onConfirm: () => {
          allowLeaveRef.current = true;
          reactNavigation.dispatch(e.data.action);
        },
      });
    });
    return unsubscribe;
  }, [intl, reactNavigation]);

  const handleSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }
    // Kept enabled even when incomplete: rather than a dead disabled button,
    // flag the rows still missing a valid word so the user sees what to fill.
    if (!canSubmit) {
      setFlagIncomplete(true);
      // On a two-face plate the red flags only paint on the visible face, so a
      // Confirm whose first gap sits on the hidden face would look like a dead
      // tap. Flip to the face that holds the first offender so the flag shows.
      const firstBad = firstNonVerifiedKeyTagRowIndex(rows);
      if (firstBad >= 0) {
        setSide(firstBad < KEY_TAG_PLATE_ROWS ? 'front' : 'back');
      }
      return;
    }
    setSubmitting(true);
    try {
      const mnemonic = keyTagRowsToMnemonic(rows);
      const mnemonicEncoded =
        await backgroundApiProxy.servicePassword.encodeSensitiveText({
          text: mnemonic,
        });
      try {
        const { mnemonicType } =
          await backgroundApiProxy.serviceAccount.validateMnemonic(
            mnemonicEncoded,
          );
        allowLeaveRef.current = true;
        defaultLogger.account.wallet.walletAdded({
          status: 'success',
          addMethod: 'ImportWallet',
          details: { importType: 'keyTag' },
          isSoftwareWalletOnlyUser,
        });
        defaultLogger.setting.page.keyTagImportResult({ isSuccess: true });
        navigation.push(EOnboardingPagesV2.FinalizeWalletSetup, {
          mnemonic: mnemonicEncoded,
          mnemonicType,
          isWalletBackedUp: true,
        });
      } catch (_error) {
        // validateMnemonic is @toastIfError() and throws InvalidMnemonic, so
        // the "Invalid phrases" toast is already raised for us.
        defaultLogger.setting.page.keyTagImportResult({ isSuccess: false });
      }
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, isSoftwareWalletOnlyUser, navigation, rows, submitting]);

  const wordCountOptions = useMemo(
    () =>
      KEY_TAG_WORD_COUNTS.map((count) => ({
        label: intl.formatMessage(
          { id: ETranslations.count_words },
          { length: count },
        ),
        value: count,
      })),
    [intl],
  );

  const confirmLabel = intl.formatMessage({ id: ETranslations.global_confirm });

  const confirmButton = (
    <Button
      flexGrow={1}
      flexBasis={0}
      size="large"
      variant="primary"
      disabled={submitting}
      loading={submitting}
      onPress={handleSubmit}
      testID={OnboardingTestIDs.importKeyTagConfirm}
    >
      {confirmLabel}
    </Button>
  );

  // >12-word mnemonics span two plates shown as one card that flips. The front
  // is filled first, then "Next" flips to the back; the primary CTA only
  // becomes "Confirm" once the back is showing.
  const isMultiPlate = rows.length > KEY_TAG_PLATE_ROWS;
  const showNextAction = isMultiPlate && side === 'front';
  const showFlipBack = isMultiPlate && side === 'back';
  const nextLabel = intl.formatMessage({
    id: ETranslations.keytag_flip_to_back__action,
  });
  const flipToFrontLabel = intl.formatMessage({
    id: ETranslations.keytag_flip_to_front__action,
  });
  const nextButton = (
    <Button
      flexGrow={1}
      flexBasis={0}
      size="large"
      variant="primary"
      icon="RotateAxisOutline"
      onPress={handleFlipToBack}
      testID={OnboardingTestIDs.importKeyTagFlipNext}
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
      testID={OnboardingTestIDs.importKeyTagFlipBack}
    >
      {flipToFrontLabel}
    </Button>
  );

  return (
    <OnboardingPage testID={OnboardingTestIDs.importKeyTagPage} scrollable>
      <YStack $gtMd={{ flexDirection: 'row' }}>
        <YStack gap="$8" $gtMd={{ flex: 1, gap: '$12' }}>
          <OnboardingHeading>
            {intl.formatMessage({
              id: ETranslations.keytag_import_short__title,
            })}
          </OnboardingHeading>
          <YStack gap="$5" pb="$5">
            <XStack alignItems="center">
              <Select
                testID={OnboardingTestIDs.importKeyTagWordCount}
                title={intl.formatMessage({
                  id: ETranslations.select_recovery_phrase_length,
                })}
                placement="bottom-start"
                items={wordCountOptions}
                value={wordCount}
                onChange={handleWordCountChange}
                renderTrigger={({ value }) => (
                  <Button
                    iconAfter="ChevronDownSmallOutline"
                    size="small"
                    variant="tertiary"
                    testID={`${OnboardingTestIDs.importKeyTagWordCount}-trigger`}
                  >
                    {intl.formatMessage(
                      { id: ETranslations.count_words },
                      { length: value },
                    )}
                  </Button>
                )}
              />
            </XStack>

            <KeyTagInputBoard
              rows={rows}
              touchedMask={touchedMask}
              side={side}
              flagIncomplete={flagIncomplete}
              onToggleHole={handleToggleHole}
            />

            {gtMd ? (
              <XStack gap="$3" alignSelf="stretch">
                {showFlipBack ? flipBackButton : null}
                {showNextAction ? nextButton : confirmButton}
              </XStack>
            ) : null}
          </YStack>
        </YStack>
        {gtMd ? (
          <OnboardingSidebar>
            {/* product shot of the physical KeyTag plate, in the badge slot */}
            <Image
              width={56}
              height={56}
              alignSelf="flex-start"
              mb="$8"
              source={require('@onekeyhq/kit/assets/keytag/keytag_plate.png')}
            />
            <YStack gap="$6">
              {sidebarFaqs.map((item) => (
                <YStack key={item.titleId} gap="$1">
                  <SizableText size="$bodyLgMedium">
                    {intl.formatMessage({ id: item.titleId })}
                  </SizableText>
                  <SizableText size="$bodyLg" color="$textSubdued">
                    {intl.formatMessage({ id: item.descriptionId })}
                  </SizableText>
                </YStack>
              ))}
              <YStack gap="$1">
                <SizableText size="$bodyLgMedium">
                  {intl.formatMessage({
                    id: ETranslations.keytag_import_no_device__title,
                  })}
                </SizableText>
                <Anchor
                  href={KEYTAG_PRODUCT_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  size="$bodyLg"
                  color="$textInfo"
                >
                  {intl.formatMessage({
                    id: ETranslations.keytag_import_buy__action,
                  })}
                </Anchor>
              </YStack>
            </YStack>
          </OnboardingSidebar>
        ) : null}
      </YStack>

      {!gtMd ? (
        <Page.Footer>
          <Page.FooterActions
            pb={safeAreaBottom ? safeAreaBottom + 8 : 20}
            onConfirmText={showNextAction ? nextLabel : confirmLabel}
            confirmButtonProps={
              showNextAction
                ? {
                    testID: OnboardingTestIDs.importKeyTagFlipNext,
                    icon: 'RotateAxisOutline',
                    onPress: handleFlipToBack,
                  }
                : {
                    testID: OnboardingTestIDs.importKeyTagConfirm,
                    disabled: submitting,
                    loading: submitting,
                    onPress: handleSubmit,
                  }
            }
            {...(showFlipBack
              ? {
                  onCancelText: flipToFrontLabel,
                  // 1-arg handler so FooterActions does not auto-pop the page.
                  onCancel: (_close: () => void) => setSide('front'),
                  cancelButtonProps: {
                    icon: 'RotateAxisOutline',
                    testID: OnboardingTestIDs.importKeyTagFlipBack,
                  },
                }
              : {})}
          />
        </Page.Footer>
      ) : null}
    </OnboardingPage>
  );
}

export default ImportKeyTag;
