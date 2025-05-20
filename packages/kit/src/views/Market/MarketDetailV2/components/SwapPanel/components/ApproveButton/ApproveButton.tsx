import { useCallback, useState } from 'react';

import { Button } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';

export interface IApproveButtonProps extends IButtonProps {
  onApprove: () => void;
}

export function ApproveButton({ onApprove, ...props }: IApproveButtonProps) {
  const [loading, setLoading] = useState(false);
  const handleApprove = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      onApprove();
      setLoading(false);
    }, 1000);
  }, [onApprove]);

  return (
    <Button
      variant="primary"
      size="large"
      loading={loading}
      {...props}
      onPress={handleApprove}
    >
      Approve
    </Button>
  );
}
