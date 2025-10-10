import { useCallback, useEffect, useState } from 'react';

import { usePreventRemove } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Markdown,
  Page,
  ScrollView,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAppUpdateRoutes,
  IAppUpdatePagesParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isForceUpdateStrategy } from '../../../components/UpdateReminder/hooks';
import { UpdatePreviewActionButton } from '../components/UpdatePreviewActionButton';
import { ViewUpdateHistory } from '../components/ViewUpdateHistory';

const ExtPluginText = platformEnv.isExtension
  ? () => {
      const intl = useIntl();
      return (
        <YStack px="$5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.update_recommend_regular_check_and_update_plugin,
            })}
          </SizableText>
        </YStack>
      );
    }
  : () => null;

function UpdatePreview({
  route,
}: IPageScreenProps<IAppUpdatePagesParamList, EAppUpdateRoutes.UpdatePreview>) {
  const intl = useIntl();
  const headerLeft = useCallback(() => {
    return null;
  }, []);
  const {
    latestVersion: latestVersionParam,
    isForceUpdate: isForceUpdateParam,
    autoClose = false,
  } = route.params || {};
  const [isForceUpdate, setIsForceUpdate] = useState(isForceUpdateParam);
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const [changeLog, setChangeLog] = useState<string | undefined>(
    appUpdateInfo.changeLog,
  );
  const [latestVersion, setLatestVersion] = useState<string | undefined>(
    latestVersionParam,
  );
  useEffect(() => {
    void backgroundApiProxy.serviceAppUpdate
      .fetchAppUpdateInfo(true)
      .then((response) => {
        setIsForceUpdate(isForceUpdateStrategy(response.updateStrategy));
        setChangeLog(response.changeLog);
        setLatestVersion(response.latestVersion);
      });
  }, []);

  usePreventRemove(!!isForceUpdate, () => {});

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.update_changelog_title },
          { ver: latestVersion || '' },
        )}
        headerLeft={isForceUpdate ? headerLeft : undefined}
      />
      <Page.Body mt={0}>
        <ExtPluginText />
        {changeLog ? (
          <ScrollView
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ pb: '$5', px: '$5' }}
          >
            <Markdown>{changeLog}</Markdown>
            <ViewUpdateHistory />
          </ScrollView>
        ) : null}
      </Page.Body>
      <UpdatePreviewActionButton
        autoClose={autoClose}
        isForceUpdate={isForceUpdate}
      />
    </Page>
  );
}

export default UpdatePreview;
