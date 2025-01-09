import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => {
  const intl = useIntl();
  const helpLink = useHelpLink({
    path: 'articles/9131347902223-Update-your-OneKey-App',
  });
  return (
    <Page.Footer
      confirmButtonProps={{
        onPress: () => {
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
