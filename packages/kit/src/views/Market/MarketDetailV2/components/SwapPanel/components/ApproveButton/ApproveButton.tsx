import { useIntl } from 'react-intl';

import { Button, useMedia } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IApproveButtonProps extends IButtonProps {
  onApprove: () => void;
}

export function ApproveButton({ onApprove, ...props }: IApproveButtonProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();

  return (
    <Button
      variant="primary"
      size={gtMd ? 'medium' : 'large'}
      {...props}
      onPress={onApprove}
    >
      {intl.formatMessage({ id: ETranslations.global_approve })}
    </Button>
  );
}
