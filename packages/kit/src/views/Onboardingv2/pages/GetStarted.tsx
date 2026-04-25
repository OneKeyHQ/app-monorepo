import { useEffect, useMemo, useRef, useState } from 'react';

import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { TermsAndPrivacy } from '../../Onboarding/pages/GetStarted/components';
import { OnboardingPage } from '../components/Layout';

// English fallbacks kept for dev/unsynced-locale resilience.
const HERO_SENTENCE_DEFAULT = 'Your most secure crypto wallet for {action}';
const HERO_ACTIONS = [
  {
    id: ETranslations.onboarding_hero_action_trading,
    defaultMessage: 'trading',
  },
  {
    id: ETranslations.onboarding_hero_action_earning,
    defaultMessage: 'earning',
  },
  {
    id: ETranslations.onboarding_hero_action_swap,
    defaultMessage: 'swapping',
  },
  {
    id: ETranslations.onboarding_hero_action_buying,
    defaultMessage: 'buying',
  },
] as const;
// Private sentinel we inject in place of {action} so we can split the
// localized template into prefix/suffix fragments around the rotating word.
const HERO_ACTION_MARKER = '\u0000ACTION\u0000';

const HERO_CHAR_STAGGER_MS = 45;
const HERO_CHAR_ANIMATION_MS = 550;
const HERO_WORD_DISPLAY_MS = 2600;
// Long enough for the last char's staggered exit to finish (550ms animation +
// 20 × 45ms stagger covers words up to 20 graphemes).
const HERO_EXIT_CLEANUP_MS = HERO_CHAR_ANIMATION_MS + 20 * HERO_CHAR_STAGGER_MS;

// Unicode-safe grapheme split: handles CJK, combining marks, emoji ZWJ
// sequences. Falls back to codepoint split where Intl.Segmenter is missing
// (Hermes without intl polyfill).
function splitGraphemes(str: string): string[] {
  try {
    const Seg = (Intl as unknown as { Segmenter?: unknown }).Segmenter;
    if (typeof Seg === 'function') {
      const SegCtor = Seg as new (
        locale: string | undefined,
        options: { granularity: 'grapheme' },
      ) => { segment: (s: string) => Iterable<{ segment: string }> };
      const segmenter = new SegCtor(undefined, { granularity: 'grapheme' });
      return Array.from(segmenter.segment(str), (s) => s.segment);
    }
  } catch {
    // fall through to codepoint split
  }
  return Array.from(str);
}

function HeroCharLayer({
  word,
  mode,
}: {
  word: string;
  mode: 'enter' | 'exit';
}) {
  const chars = splitGraphemes(word);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    // Double rAF: first paints the initial (hidden) state, second triggers
    // the transition. Without this, the browser/engine coalesces both into
    // one paint and the element appears without animating.
    let raf2: number | null = null;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setActivated(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2 !== null) cancelAnimationFrame(raf2);
    };
  }, []);

  const isEnter = mode === 'enter';
  // enter mode: activated=false → hidden above; activated=true → visible
  // exit mode:  activated=false → visible;       activated=true → hidden below
  const visible = isEnter ? activated : !activated;
  const hiddenYOffset = isEnter ? -24 : 24;
  const yOffset = visible ? 0 : hiddenYOffset;

  return (
    <XStack position="absolute" top={0} left={0} right={0}>
      {chars.map((char, i) => {
        const delay = i * HERO_CHAR_STAGGER_MS;
        // Native skips filter (no RN primitive); web uses inline CSS so the
        // browser interpolates blur natively (Reanimated cannot).
        if (platformEnv.isNative) {
          return (
            <MotiView
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              animate={{
                opacity: visible ? 1 : 0,
                translateY: yOffset,
              }}
              transition={
                {
                  type: 'timing',
                  duration: HERO_CHAR_ANIMATION_MS,
                  delay,
                } as any
              }
            >
              <SizableText
                size="$heading5xl"
                fontWeight={600}
                accessible={false}
              >
                {char === ' ' ? '\u00A0' : char}
              </SizableText>
            </MotiView>
          );
        }
        return (
          <YStack
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={
              {
                opacity: visible ? 1 : 0,
                transform: `translateY(${yOffset}px)`,
                filter: visible ? 'blur(0px)' : 'blur(6px)',
                transition: `opacity ${HERO_CHAR_ANIMATION_MS}ms, transform ${HERO_CHAR_ANIMATION_MS}ms, filter ${HERO_CHAR_ANIMATION_MS}ms`,
                transitionDelay: `${delay}ms`,
              } as any
            }
          >
            <SizableText size="$heading5xl" fontWeight={600} accessible={false}>
              {char === ' ' ? '\u00A0' : char}
            </SizableText>
          </YStack>
        );
      })}
    </XStack>
  );
}

function HeroRotatingWord({ words }: { words: string[] }) {
  const [wordIndex, setWordIndex] = useState(0);
  const [exitingIndex, setExitingIndex] = useState<number | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordsLength = words.length;

  useEffect(() => {
    if (wordsLength === 0) {
      return;
    }
    const intervalId = setInterval(() => {
      setWordIndex((current) => {
        setExitingIndex(current);
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
        }
        exitTimerRef.current = setTimeout(() => {
          setExitingIndex(null);
        }, HERO_EXIT_CLEANUP_MS);
        return (current + 1) % wordsLength;
      });
    }, HERO_WORD_DISPLAY_MS);
    return () => {
      clearInterval(intervalId);
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, [wordsLength]);

  const currentWord = words[wordIndex] ?? '';
  const exitingWord =
    exitingIndex !== null ? (words[exitingIndex] ?? null) : null;

  // Reserve layout space for the widest translated word so the surrounding
  // sentence doesn't reflow when the cycling word changes length.
  const longestWord = useMemo(
    () =>
      words.reduce(
        (longest, word) => (word.length > longest.length ? word : longest),
        '',
      ),
    [words],
  );

  return (
    <YStack position="relative" accessible accessibilityLabel={currentWord}>
      <SizableText
        size="$heading5xl"
        fontWeight={600}
        opacity={0}
        accessible={false}
      >
        {longestWord || '\u00A0'}
      </SizableText>
      {exitingWord !== null && exitingIndex !== null ? (
        <HeroCharLayer
          key={`exit-${exitingIndex}`}
          word={exitingWord}
          mode="exit"
        />
      ) : null}
      <HeroCharLayer
        key={`enter-${wordIndex}`}
        word={currentWord}
        mode="enter"
      />
    </YStack>
  );
}

type IHeroLineMetric = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Native-only layout. React Native's flex treats text elements as rectangular
// boxes (width = longest line), so the trailing whitespace on a wrapped
// prefix's last line is invisible to sibling flex items — the rotating word
// gets pushed to a new line even when it would visually fit inline. We work
// around this by measuring the prefix's per-line metrics via onTextLayout and
// absolute-positioning the rotating word (and suffix) at the end of the last
// line when they fit.
function HeroSentenceNative({
  prefix,
  suffix,
  rotating,
}: {
  prefix: string;
  suffix: string;
  rotating: React.ReactElement;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [prefixLines, setPrefixLines] = useState<IHeroLineMetric[]>([]);
  const [rotatingDims, setRotatingDims] = useState<{
    w: number;
    h: number;
  } | null>(null);
  const [suffixWidth, setSuffixWidth] = useState(0);

  const lastLine = prefixLines[prefixLines.length - 1];
  const tailX = lastLine ? lastLine.x + lastLine.width : 0;
  const tailY = lastLine?.y ?? 0;
  const lineHeight = lastLine?.height ?? rotatingDims?.h ?? 0;

  const rotatingWidth = rotatingDims?.w ?? 0;
  const inlineFootprint = rotatingWidth + suffixWidth;
  const fitsInline =
    containerWidth > 0 && tailX + inlineFootprint <= containerWidth;

  const rotatingX = fitsInline ? tailX : 0;
  const rotatingY = fitsInline ? tailY : tailY + lineHeight;
  const suffixX = rotatingX + rotatingWidth;
  const suffixY = rotatingY;

  const prefixBottom = lastLine ? tailY + lineHeight : 0;
  const totalHeight = fitsInline ? prefixBottom : prefixBottom + lineHeight;

  const hasPrefix = prefix.length > 0;
  const hasSuffix = suffix.length > 0;
  const isMeasured =
    containerWidth > 0 &&
    rotatingDims !== null &&
    (!hasPrefix || prefixLines.length > 0) &&
    (!hasSuffix || suffixWidth > 0);

  return (
    <YStack
      onLayout={(e) => {
        setContainerWidth(e.nativeEvent.layout.width);
      }}
      minHeight={isMeasured ? totalHeight : undefined}
      opacity={isMeasured ? 1 : 0}
    >
      {hasPrefix ? (
        <SizableText
          size="$heading5xl"
          fontWeight={400}
          onTextLayout={(e) => {
            const next = e.nativeEvent.lines.map((line) => ({
              x: line.x,
              y: line.y,
              width: line.width,
              height: line.height,
            }));
            setPrefixLines((prev) => {
              if (
                prev.length === next.length &&
                prev.every(
                  (p, i) =>
                    p.x === next[i].x &&
                    p.y === next[i].y &&
                    p.width === next[i].width &&
                    p.height === next[i].height,
                )
              ) {
                return prev;
              }
              return next;
            });
          }}
        >
          {prefix}
        </SizableText>
      ) : null}

      <YStack
        position="absolute"
        left={rotatingX}
        top={rotatingY}
        alignSelf="flex-start"
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          const h = e.nativeEvent.layout.height;
          setRotatingDims((prev) =>
            prev && prev.w === w && prev.h === h ? prev : { w, h },
          );
        }}
      >
        {rotating}
      </YStack>

      {hasSuffix ? (
        <YStack
          position="absolute"
          left={suffixX}
          top={suffixY}
          alignSelf="flex-start"
          onLayout={(e) => {
            setSuffixWidth(e.nativeEvent.layout.width);
          }}
        >
          <SizableText size="$heading5xl" fontWeight={400}>
            {suffix}
          </SizableText>
        </YStack>
      ) : null}
    </YStack>
  );
}

function GetStarted() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { gtMd } = useMedia();

  const handleCreateNewWallet = () => {
    navigation.push(EOnboardingPagesV2.CreateNewWallet);
  };

  const handleMoreOptions = () => {
    navigation.push(EOnboardingPagesV2.CreateOrImportWallet);
  };

  const handleConnectHardwareWallet = () => {
    navigation.push(EOnboardingPagesV2.PickYourDevice);
    defaultLogger.account.wallet.onboard({ onboardMethod: 'connectHWWallet' });
  };

  const heroActionWords = useMemo(
    () =>
      HERO_ACTIONS.map(({ id, defaultMessage }) =>
        intl.formatMessage({ id, defaultMessage }),
      ),
    [intl],
  );
  const heroSentenceTemplate = useMemo(
    () =>
      intl.formatMessage(
        {
          id: ETranslations.onboarding_hero_sentence,
          defaultMessage: HERO_SENTENCE_DEFAULT,
        },
        { action: HERO_ACTION_MARKER },
      ),
    [intl],
  );
  const [heroPrefix = '', heroSuffix = ''] =
    heroSentenceTemplate.split(HERO_ACTION_MARKER);

  const actions = [
    {
      labelId: ETranslations.onboarding_create_new_wallet,
      icon: 'PlusCircleSolid',
      onPress: handleCreateNewWallet,
      mobileButtonProps: { variant: 'primary' },
    },
    {
      labelId: ETranslations.add_existing_wallet,
      icon: 'ArrowBottomCircleSolid',
      onPress: handleMoreOptions,
      mobileButtonProps: { variant: 'secondary' },
    },
    {
      labelId: ETranslations.global_connect_hardware_wallet,
      icon: 'EnergyCircleSolid',
      onPress: handleConnectHardwareWallet,
      mobileButtonProps: {
        bg: '$transparent',
        borderWidth: 1,
        borderColor: '$borderSubdued',
      },
    },
  ] as const;

  return (
    <OnboardingPage
      headerBack="exit"
      contentContainerProps={
        platformEnv.isNative
          ? undefined
          : { enterStyle: { opacity: 0, scale: 0.9 } }
      }
    >
      <YStack
        $md={{
          flex: 1,
          px: '$5',
          pt: '$8',
        }}
        gap="$8"
      >
        <Icon name="OnekeyTextIllus" color="$text" h={48} w={174} />
        {platformEnv.isNative ? (
          <HeroSentenceNative
            prefix={heroPrefix}
            suffix={heroSuffix}
            rotating={<HeroRotatingWord words={heroActionWords} />}
          />
        ) : (
          <XStack flexWrap="wrap" alignItems="baseline">
            {heroPrefix ? (
              <SizableText size="$heading5xl" fontWeight={400}>
                {heroPrefix}
              </SizableText>
            ) : null}
            <HeroRotatingWord words={heroActionWords} />
            {heroSuffix ? (
              <SizableText size="$heading5xl" fontWeight={400}>
                {heroSuffix}
              </SizableText>
            ) : null}
          </XStack>
        )}
      </YStack>
      <YStack
        gap="$6"
        $gtMd={{
          pt: '$20',
        }}
      >
        <TermsAndPrivacy
          contentContainerProps={{
            $md: {
              px: '$5',
            },
          }}
        />
        {gtMd ? (
          <XStack gap="$4" h="$40">
            {actions.map((action) => (
              <YStack
                flexGrow={1}
                flexBasis={0}
                justifyContent="space-between"
                bg="$bgStrong"
                p="$6"
                key={action.labelId}
                onPress={action.onPress}
                borderRadius="$6"
                borderCurve="continuous"
                $platform-web={{
                  boxShadow:
                    'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.16), 0 1px 1px -0.5px rgba(0, 0, 0, 0.18), 0 3px 3px -1.5px rgba(0, 0, 0, 0.18), 0 6px 6px -3px rgba(0, 0, 0, 0.18), 0 12px 12px -6px rgba(0, 0, 0, 0.18)',
                }}
                hoverStyle={{
                  bg: '$bgStrongHover',
                }}
                pressStyle={{
                  bg: '$bgStrongActive',
                }}
                userSelect="none"
              >
                <Icon size="$8" color="$iconActive" name={action.icon} />
                <SizableText size="$headingLg">
                  {intl.formatMessage({ id: action.labelId })}
                </SizableText>
              </YStack>
            ))}
          </XStack>
        ) : (
          <YStack gap="$3">
            {actions.map((action) => (
              <Button
                key={action.labelId}
                size="large"
                alignSelf="stretch"
                onPress={action.onPress}
                {...action.mobileButtonProps}
              >
                {intl.formatMessage({ id: action.labelId })}
              </Button>
            ))}
          </YStack>
        )}
      </YStack>
    </OnboardingPage>
  );
}

function GetStartedWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <GetStarted />
    </AccountSelectorProviderMirror>
  );
}
export default GetStartedWithContext;
