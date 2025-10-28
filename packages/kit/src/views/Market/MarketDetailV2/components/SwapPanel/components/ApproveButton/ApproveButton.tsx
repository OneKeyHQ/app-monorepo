import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export interface IApproveButtonProps extends IButtonProps {
  onApprove: () => void;
}

export function ApproveButton({ onApprove, ...props }: IApproveButtonProps) {
  const intl = useIntl();

  return (
    <Button variant="primary" size="large" {...props} onPress={onApprove}>
      {intl.formatMessage({ id: ETranslations.global_approve })}
    </Button>
  );
}
