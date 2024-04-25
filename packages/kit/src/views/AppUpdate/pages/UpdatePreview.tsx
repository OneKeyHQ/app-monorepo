import { useCallback, useState } from 'react';

import { UNSTABLE_usePreventRemove as usePreventRemove } from '@react-navigation/core';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Badge,
  Heading,
  Icon,
  Markdown,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAppUpdateRoutes,
  IAppUpdatePagesParamList,
} from '@onekeyhq/shared/src/routes';

import { useAppChangeLog } from '../../../components/UpdateReminder/hooks';
import { UpdatePreviewActionButton } from '../components/UpdatePreviewActionButton';
import { ViewUpdateHistory } from '../components/ViewUpdateHistory';

const ExtPluginText = platformEnv.isExtension ? (
  <SizableText size="$bodyMd" color="$textSubdued">
    To ensure you get the best experience, we recommend that you regularly check
    for and manually update the plugin.
  </SizableText>
) : null;

function UpdatePreview({
  route,
}: IPageScreenProps<IAppUpdatePagesParamList, EAppUpdateRoutes.UpdatePreview>) {
  const {
    latestVersion,
    isForceUpdate,
    autoClose = false,
  } = route.params || {};
  usePreventRemove(!!isForceUpdate, () => {});
  const changeLog = useAppChangeLog(latestVersion);
  return (
    <Page>
      <Page.Header title="App Update" />
      <Page.Body m="$5">
        <YStack space="$3">
          <Heading size="$heading2xl">New App Version 🎉</Heading>
          {ExtPluginText}
          <XStack space="$2.5" alignItems="center">
            <Badge badgeType="default" badgeSize="lg">
              {platformEnv.version}
            </Badge>
            <Icon name="ArrowRightSolid" size="$4" />
            <Badge badgeType="info" badgeSize="lg">
              {latestVersion}
            </Badge>
          </XStack>
        </YStack>
        {changeLog ? (
          <ScrollView
            mt="$7"
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={{ pb: '$5' }}
          >
            <Markdown>{changeLog}</Markdown>
            <ViewUpdateHistory />
          </ScrollView>
        ) : null}
      </Page.Body>
      <UpdatePreviewActionButton autoClose={autoClose} />
    </Page>
  );
}

export default UpdatePreview;
