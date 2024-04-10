import { Page } from '@onekeyhq/components';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => {
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
      onConfirmText="Manual Update"
    />
  );
};
