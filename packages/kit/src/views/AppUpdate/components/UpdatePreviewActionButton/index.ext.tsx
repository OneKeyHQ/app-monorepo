import { Page } from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => (
  <Page.Footer
    confirmButtonProps={{
      onPress: () => {
        // TODO: i18n
        openUrlExternal(
          'https://help.onekey.so/hc/en-us/articles/9131347902223-Update-your-OneKey-App',
        );
      },
      iconAfter: 'ArrowTopRightOutline',
    }}
    onConfirmText="Manual Update"
  />
);
