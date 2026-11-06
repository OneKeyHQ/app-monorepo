import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { AppUpdateTestIDs } from '../../testIDs';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = ({
  isForceUpdate,
  onContactSupport,
}) => {
  const intl = useIntl();
  const helpLink = useHelpLink({
    path: 'articles/11461166',
  });
  return (
    <Page.Footer
      stacked={isForceUpdate}
      onCancelText={
        isForceUpdate
          ? intl.formatMessage({ id: ETranslations.swap_review_tx_failed_2 })
          : undefined
      }
      onCancel={
        isForceUpdate
          ? (_close) => {
              if (onContactSupport) {
                onContactSupport();
                return;
              }
              void showIntercom();
            }
          : undefined
      }
      cancelButtonProps={
        isForceUpdate
          ? {
              testID: AppUpdateTestIDs.contactUsBtn,
            }
          : undefined
      }
      confirmButtonProps={{
        onPress: () => {
          defaultLogger.app.appUpdate.changelogUpdateClicked({
            action: 'helpLink',
          });
          openUrlExternal(helpLink);
        },
        iconAfter: 'ArrowTopRightOutline',
      }}
      onConfirmText={intl.formatMessage({
        id: ETranslations.update_manual_update,
      })}
    />
  );
};
