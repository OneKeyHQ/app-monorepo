import Markdown from 'react-native-markdown-display';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Badge,
  Heading,
  Icon,
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

import { UpdatePreviewActionButton } from '../components/UpdatePreviewActionButton';

const ExtPluginText = platformEnv.isExtension ? (
  <SizableText size="$bodyMd" color="$textSubdued">
    To ensure you get the best experience, we recommend that you regularly check
    for and manually update the plugin.
  </SizableText>
) : null;

function UpdatePreview({
  route,
}: IPageScreenProps<IAppUpdatePagesParamList, EAppUpdateRoutes.UpdatePreview>) {
  const { version, latestVersion, changeLog } = route.params || {};
  return (
    <Page>
      <Page.Header title="App Update" />
      <Page.Body p="$5">
        <YStack space="$3">
          <Heading size="$heading2xl">New App Version 🎉</Heading>
          {ExtPluginText}
          <XStack space="$2.5" alignItems="center">
            <Badge badgeType="default" badgeSize="lg">
              {version}
            </Badge>
            <Icon name="ArrowRightSolid" size="$4" />
            <Badge badgeType="info" badgeSize="lg">
              {latestVersion}
            </Badge>
          </XStack>
        </YStack>
        <ScrollView pt="$12" contentInsetAdjustmentBehavior="automatic">
          <Heading size="$headingMd">✨ New Features</Heading>
          <Markdown>{changeLog}</Markdown>
        </ScrollView>
      </Page.Body>
      <UpdatePreviewActionButton />
    </Page>
  );
}

export default UpdatePreview;
