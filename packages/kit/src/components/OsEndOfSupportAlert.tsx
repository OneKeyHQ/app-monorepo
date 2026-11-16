import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Button, Stack } from '@onekeyhq/components';
import { useBannerClosePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { getOsEndOfSupportNotice } from '@onekeyhq/shared/src/osEndOfSupport';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

function BasicOsEndOfSupportAlert() {
  const intl = useIntl();
  const [bannerClose, setBannerClose] = useBannerClosePersistAtom();
  const notice = useMemo(() => getOsEndOfSupportNotice(), []);
  const noticeId = notice?.id;
  const learnMoreUrl = notice?.learnMoreUrl;

  const handleClose = useCallback(() => {
    if (!noticeId) {
      return;
    }
    setBannerClose({
      ids: [...new Set([...bannerClose.ids, noticeId])],
    });
  }, [bannerClose.ids, noticeId, setBannerClose]);

  const handleLearnMore = useCallback(() => {
    if (learnMoreUrl) {
      openUrlExternal(learnMoreUrl);
    }
  }, [learnMoreUrl]);

  if (!notice || bannerClose.ids.includes(notice.id)) {
    return null;
  }

  return (
    <Stack pt="$2" px="$pagePadding" bg="$bgApp">
      <Alert
        type="warning"
        icon="InfoCircleOutline"
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
