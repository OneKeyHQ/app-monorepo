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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EAppUpdateRoutes,
  IAppUpdatePagesParamList,
} from '@onekeyhq/shared/src/routes';

import { useAppChangeLog } from '../../../components/UpdateReminder/hooks';
import { UpdatePreviewActionButton } from '../components/UpdatePreviewActionButton';
import { ViewUpdateHistory } from '../components/ViewUpdateHistory';

const ExtPluginText = platformEnv.isExtension
  ? () => {
      const intl = useIntl();
      return (
        <YStack>
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
  const {
    latestVersion,
    isForceUpdate,
    autoClose = false,
  } = route.params || {};
  usePreventRemove(!!isForceUpdate, () => {});
  const response = useAppChangeLog(latestVersion);
  const { changeLog } = response ?? {};
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage(
          { id: ETranslations.update_changelog_title },
          { ver: latestVersion || '' },
        )}
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
