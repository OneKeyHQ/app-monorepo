import { memo, useCallback, useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  LinearGradient,
  Page,
  ScrollView,
  useTheme,
} from '@onekeyhq/components';
import { Markdown } from '@onekeyhq/components/src/content/Markdown';
import { displayWhatsNewVersion } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppChangeLog } from '../../../components/AppUpdate';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ViewUpdateHistory } from '../components/ViewUpdateHistory';

const FooterGradient = memo(() => {
  const theme = useTheme();
  return (
    <LinearGradient
      position="absolute"
      top={-24}
      left={0}
      right={0}
      height={25}
      colors={[`${theme.bgApp.val}00`, theme.bgApp.val]}
      start={[0, 0]}
      end={[0, 1]}
      pointerEvents="none"
    />
  );
});

FooterGradient.displayName = 'FooterGradient';

function WhatsNew() {
  const intl = useIntl();
  const changeLog = useAppChangeLog();
  const navigation = useAppNavigation();
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    const mountTime = mountTimeRef.current;
    return () => {
      defaultLogger.app.appUpdate.whatsNewClosed({
        durationMs: Date.now() - mountTime,
      });
    };
  }, []);
  const handleClose = useCallback(() => {
    setTimeout(() => {
      void backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
    }, 250);
  }, []);
  return (
    <Page onClose={handleClose}>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.update_changelog_updated_title },
          {
            ver: displayWhatsNewVersion(),
          },
        )}
      />
      <Page.Body mx="$5">
        {changeLog ? (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ pb: '$8' }}
          >
            <Markdown>{changeLog}</Markdown>
            <ViewUpdateHistory />
          </ScrollView>
        ) : null}
      </Page.Body>
      <Page.Footer>
        <FooterGradient />
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_done,
          })}
          onConfirm={navigation.pop}
        />
      </Page.Footer>
    </Page>
  );
}

export default WhatsNew;
