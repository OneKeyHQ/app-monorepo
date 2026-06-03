import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePreventRemove } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import { Page, ScrollView, SizableText, YStack } from '@onekeyhq/components';
import { Markdown } from '@onekeyhq/components/src/content/Markdown';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  type IAppUpdateInfo,
  displayAppUpdateVersion,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAppUpdateRoutes,
  IAppUpdatePagesParamList,
} from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { isForceUpdateStrategy } from '../../../components/AppUpdate';
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
    isForceUpdate: isForceUpdateParam,
    autoClose = false,
    latestVersion,
  } = route.params || {};
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const [updateInfo, setUpdateInfo] = useState<IAppUpdateInfo>(appUpdateInfo);

  useEffect(() => {
    void backgroundApiProxy.serviceAppUpdate
      .fetchAppUpdateInfo(true)
      .then((response) => {
        setUpdateInfo(response);
        if (response?.latestVersion) {
          defaultLogger.app.appUpdate.changelogViewed({
            toVersion: response.latestVersion,
            isForceUpdate: isForceUpdateStrategy(response.updateStrategy),
          });
        }
      });
  }, []);

  // `updateInfo` is seeded from the useAppUpdatePersistAtom() snapshot, which
  // during the jotai hydration race is still the non-force placeholder on the
  // first paint. Deriving the lock purely from it would leave a mandatory
  // update briefly dismissible until fetchAppUpdateInfo() resolves. The route
  // param is derived from authoritative state at navigation time, so a force
  // param must win on the first frame (fail-safe toward locked).
  const isForceUpdate =
    Boolean(isForceUpdateParam) ||
    isForceUpdateStrategy(updateInfo?.updateStrategy);
  const changeLog = updateInfo?.changeLog;
  usePreventRemove(!!isForceUpdate, () => {});

  const headerProps = useMemo(() => {
    const props: { title: string; headerLeft?: () => ReactNode } = {
      title: intl.formatMessage(
        { id: ETranslations.update_changelog_title },
        {
          ver: updateInfo ? displayAppUpdateVersion(updateInfo) : latestVersion,
        },
      ),
    };
    if (isForceUpdate) {
      props.headerLeft = headerLeft;
    }
    return props;
  }, [intl, updateInfo, latestVersion, isForceUpdate, headerLeft]);

  return (
    <Page>
      <Page.Header {...headerProps} />
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
