import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Button, Stack } from '@onekeyhq/components';
import { useOsEndOfSupportNoticePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  getOsEndOfSupportNotice,
  isOsEndOfSupportNoticeDismissed,
} from '@onekeyhq/shared/src/osEndOfSupport';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

function BasicOsEndOfSupportAlert() {
  const intl = useIntl();
  const [{ dismissedAt }, setNoticeState] =
    useOsEndOfSupportNoticePersistAtom();
  const notice = useMemo(() => getOsEndOfSupportNotice(), []);
  const noticeId = notice?.id;
  const learnMoreUrl = notice?.learnMoreUrl;

  const handleClose = useCallback(() => {
    if (!noticeId) {
      return;
    }
    setNoticeState((prev) => ({
      ...prev,
      dismissedAt: { ...prev.dismissedAt, [noticeId]: Date.now() },
    }));
  }, [noticeId, setNoticeState]);

  const handleLearnMore = useCallback(() => {
    if (learnMoreUrl) {
      openUrlExternal(learnMoreUrl);
    }
  }, [learnMoreUrl]);

  if (
    !notice ||
    isOsEndOfSupportNoticeDismissed({
      dismissedAt: dismissedAt[notice.id],
      now: Date.now(),
    })
  ) {
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
