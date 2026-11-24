import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Alert, Button, Stack } from '@onekeyhq/components';
import { useOsEndOfSupportNoticePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  OS_END_OF_SUPPORT_NOTICE_REMIND_INTERVAL_MS,
  getOsEndOfSupportNotice,
  isOsEndOfSupportNoticeDismissed,
} from '@onekeyhq/shared/src/osEndOfSupport';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { useHandleAppStateActive } from '../hooks/useHandleAppStateActive';

function BasicOsEndOfSupportAlert() {
  const intl = useIntl();
  const [{ dismissedAt }, setNoticeState] =
    useOsEndOfSupportNoticePersistAtom();
  const notice = useMemo(() => getOsEndOfSupportNotice(), []);
  const noticeId = notice?.id;
  const learnMoreUrl = notice?.learnMoreUrl;

  const lastDismissedAt = noticeId ? dismissedAt[noticeId] : undefined;

  // Time is state so that the notice can come back while Home stays mounted.
  const [now, setNow] = useState(() => Date.now());
  const refreshNow = useCallback(() => setNow(Date.now()), []);
  const isDismissed = isOsEndOfSupportNoticeDismissed({
    dismissedAt: lastDismissedAt,
    now,
  });

  // Re-show exactly when the reminder interval elapses in a running app.
  useEffect(() => {
    if (!isDismissed || lastDismissedAt === undefined) {
      return;
    }
    const remaining =
      lastDismissedAt + OS_END_OF_SUPPORT_NOTICE_REMIND_INTERVAL_MS - now;
    const timer = setTimeout(refreshNow, Math.max(remaining, 0));
    return () => clearTimeout(timer);
  }, [isDismissed, lastDismissedAt, now, refreshNow]);

  // JS timers do not run reliably while the app is suspended, so check again
  // when the app returns to the foreground and when Home regains focus.
  useHandleAppStateActive(refreshNow);
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) {
      refreshNow();
    }
  }, [isFocused, refreshNow]);

  const handleClose = useCallback(() => {
    if (!noticeId) {
      return;
    }
    const closedAt = Date.now();
    // Keep the local clock in step with the stored close time; otherwise the
    // fresh timestamp would look like it is in the future.
    setNow(closedAt);
    setNoticeState((prev) => ({
      ...prev,
      dismissedAt: { ...prev.dismissedAt, [noticeId]: closedAt },
    }));
  }, [noticeId, setNoticeState]);

  const handleLearnMore = useCallback(() => {
    if (learnMoreUrl) {
      openUrlExternal(learnMoreUrl);
    }
  }, [learnMoreUrl]);

  if (!notice || isDismissed) {
    return null;
  }

  return (
    <Stack pt="$2" px="$pagePadding" bg="$bgApp">
      <Alert
        type="warning"
        icon="InfoCircleOutline"
        alignItems="flex-start"
        title={intl.formatMessage(
          { id: ETranslations.os_end_of_support_notice__title },
          { osName: notice.minSupportedName },
        )}
        description={intl.formatMessage({
          id: ETranslations.os_end_of_support_notice__desc,
        })}
        closable
        onClose={handleClose}
        testID="os-end-of-support-alert"
      >
        {learnMoreUrl ? (
          <Button
            testID="os-end-of-support-learn-more-btn"
            size="small"
            variant="tertiary"
            alignSelf="flex-start"
            onPress={handleLearnMore}
          >
            {intl.formatMessage({ id: ETranslations.global_learn_more })}
          </Button>
        ) : null}
      </Alert>
    </Stack>
  );
}

export const OsEndOfSupportAlert = memo(BasicOsEndOfSupportAlert);
