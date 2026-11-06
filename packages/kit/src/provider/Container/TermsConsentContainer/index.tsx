import { useCallback, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  DialogContainer,
  Divider,
  Icon,
  SizableText,
  YStack,
  useMedia,
  useOnRouterChange,
} from '@onekeyhq/components';
import { getTermsConsentRecheckAt } from '@onekeyhq/kit-bg/src/services/ServiceSetting/termsConsent';
import { useAppIsLockedAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock';
import { useTermsConsentPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import { formatDate } from '@onekeyhq/shared/src/utils/dateUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ITermsConsentPrompt } from '@onekeyhq/shared/types/setting';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useTermsAndPrivacyLinks } from '../../../hooks/useHelpLink';

export function TermsConsentContainer() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [isLocked] = useAppIsLockedAtom();
  const [termsConsentState] = useTermsConsentPersistAtom();
  const { acceptedVersion } = termsConsentState;
  const [prompt, setPrompt] = useState<ITermsConsentPrompt | undefined>();
  const [isOnBackupPage, setIsOnBackupPage] = useState(false);
  const [recheckSeq, setRecheckSeq] = useState(0);
  const leaveBackupTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { termsUrl, privacyUrl } = useTermsAndPrivacyLinks();
  const media = useMedia();

  // Checked on launch, after every unlock, on leaving the backup pages and
  // when a Not now runs out. A result is only kept while the dialog can
  // show: one from before a lock or a backup detour is stale by then.
  useEffect(() => {
    if (
      isLocked ||
      isOnBackupPage ||
      travelModeManager.getRuntimeEnvironmentSync().profile.kind ===
        'travel-mode'
    ) {
      setPrompt(undefined);
      return undefined;
    }
    let cancelled = false;
    void backgroundApiProxy.serviceSetting
      .getTermsConsentPrompt()
      .then((next) => {
        if (!cancelled) {
          setPrompt(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isLocked, isOnBackupPage, recheckSeq]);

  // An app kept open and unlocked never relaunches or unlocks, so a Not now
  // would outlast its snooze and the deadline without this timer.
  const recheckAt = getTermsConsentRecheckAt(termsConsentState);
  useEffect(() => {
    const delay = recheckAt === undefined ? -1 : recheckAt - Date.now();
    if (delay < 0) {
      return undefined;
    }
    const timer = setTimeout(() => setRecheckSeq((seq) => seq + 1), delay);
    return () => clearTimeout(timer);
  }, [recheckAt]);

  useEffect(() => () => clearTimeout(leaveBackupTimerRef.current), []);

  // The dialog draws above every page, so dApp and WalletConnect requests,
  // deep links and shortcuts stay covered. It steps aside only where "Back up
  // wallets" leads: the wallet list (with private key export) and the
  // onboarding pages holding the phrase, KeyTag and cloud backups. The list can
  // open inside an already open modal, so that modal's top screen decides.
  useOnRouterChange((state) => {
    const top = state?.routes[state.index ?? 0];
    const modalRoutes = top?.state?.routes;
    const modalScreen = modalRoutes
      ? modalRoutes[modalRoutes.length - 1]?.name
      : (top?.params as { screen?: string } | undefined)?.screen;
    clearTimeout(leaveBackupTimerRef.current);
    if (
      top?.name === ERootRoutes.Onboarding ||
      (top?.name === ERootRoutes.Modal &&
        modalScreen === EModalRoutes.AccountManagerStacks)
    ) {
      setIsOnBackupPage(true);
      return;
    }
    // Cloud backup passes through the home screen for a moment on its way to
    // the backup pages, so leaving only counts once it lasts.
    leaveBackupTimerRef.current = setTimeout(
      () => setIsOnBackupPage(false),
      500,
    );
  });

  const handleClose = useCallback(() => Promise.resolve(), []);

  if (
    !prompt ||
    isLocked ||
    isOnBackupPage ||
    acceptedVersion === prompt.version
  ) {
    return null;
  }

  const { version, deadlineAt, deadlinePassed } = prompt;
  // Same as Dialog footers: default size on wide screens, large on phones.
  const buttonSize = media.md ? 'large' : 'medium';

  const handleAgree = () => {
    // Closes at once and uploads in the background, so a slow network never
    // holds the wallet. Only a stored record counts: if the upload fails, the
    // prompt returns on the next launch or unlock.
    setPrompt(undefined);
    void backgroundApiProxy.serviceSetting
      .acceptTermsConsent({ source: 'dialog', version })
      .catch(() => undefined);
  };

  const handleNotNow = () => {
    // A dialog left open past the deadline can no longer be put off.
    if (Date.now() >= deadlineAt) {
      setPrompt({ version, deadlineAt, deadlinePassed: true });
      return;
    }
    setPrompt(undefined);
    void backgroundApiProxy.serviceSetting
      .snoozeTermsConsent({ version })
      .catch(() => undefined);
  };

  const handleBackUp = () => {
    // The wallet list already offers recovery phrase backup and private key
    // export for every wallet type that has something to take away.
    navigation.pushModal(EModalRoutes.AccountManagerStacks, {
      screen: EAccountManagerStacksRoutes.AccountSelectorStack,
      params: {
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
        editable: true,
      },
    });
  };

  const renderLink = (id: ETranslations, url: string) => {
    // The system browser keeps the full text above the dialog on iOS.
    const open = () =>
      openUrlExternal(url, { useSystemBrowser: platformEnv.isNativeIOS });
    return (
      <ListItem
        title={intl.formatMessage({ id })}
        drillIn={false}
        mx={0}
        px="$4"
        minHeight="$12"
        borderRadius={0}
        // Keyboard access is web-only: on native these props land on the
        // row's inner view, which then swallows the screen reader's tap.
        role={platformEnv.isNative ? undefined : 'link'}
        tabIndex={platformEnv.isNative ? undefined : 0}
        onPress={open}
        onKeyDown={
          platformEnv.isNative
            ? undefined
            : (event: { key: string; preventDefault: () => void }) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  open();
                }
              }
        }
      >
        <Icon name="ArrowTopRightOutline" size="$5" color="$iconSubdued" />
      </ListItem>
    );
  };

  return (
    <DialogContainer
      open
      testID="terms-consent-dialog"
      // Above every modal-level dialog, such as WalletConnect Pay or one from a
      // deep link, so none of them can be used before answering. Its own
      // window on iOS also keeps it up when one of them closes.
      overlayLevel="hardware"
      icon="FileTextOutline"
      title={intl.formatMessage({
        id: deadlinePassed
          ? ETranslations.terms_update_expired__title
          : ETranslations.terms_update__title,
      })}
      description={
        deadlinePassed
          ? intl.formatMessage({ id: ETranslations.terms_update_expired__desc })
          : intl.formatMessage(
              { id: ETranslations.terms_update_deadline__desc },
              {
                // A spelled-out month: day-first readers of English would
                // take a numeric 11/08 as 11 August.
                date: formatDate(new Date(deadlineAt), {
                  formatTemplate: 'PP',
                }),
              },
            )
      }
      renderContent={
        <YStack gap="$5">
          <YStack
            bg="$bgStrong"
            borderRadius="$3"
            borderCurve="continuous"
            overflow="hidden"
          >
            {renderLink(ETranslations.terms_of_use__title, termsUrl)}
            <Divider />
            {renderLink(ETranslations.privacy_policy__title, privacyUrl)}
          </YStack>
          <YStack gap="$3">
            {/* Legal: the consent statement stays right above the button that gives it. */}
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.terms_update_consent__desc,
              })}
            </SizableText>
            <YStack gap="$2">
              <Button
                testID="terms-consent-agree"
                size={buttonSize}
                variant="primary"
                onPress={handleAgree}
              >
                {intl.formatMessage({
                  id: ETranslations.terms_update_agree__action,
                })}
              </Button>
              <Button
                testID="terms-consent-secondary"
                size={buttonSize}
                variant="tertiary"
                // Same footprint as Agree: by default a tertiary button bleeds
                // past the column and is shorter to tap.
                mx="$0"
                my="$0"
                py={buttonSize === 'large' ? '$3' : '$1.5'}
                onPress={deadlinePassed ? handleBackUp : handleNotNow}
              >
                {intl.formatMessage({
                  id: deadlinePassed
                    ? ETranslations.terms_update_back_up__action
                    : ETranslations.global_not_now,
                })}
              </Button>
            </YStack>
          </YStack>
        </YStack>
      }
      // Shown right after an Enter-to-unlock, so nothing gets focus on open:
      // a second Enter must never land on Agree.
      onOpenAutoFocus={(event) => event.preventDefault()}
      showFooter={false}
      showExitButton={false}
      dismissOnOverlayPress={false}
      disableDrag
      disableSystemClose
      onClose={handleClose}
    />
  );
}
