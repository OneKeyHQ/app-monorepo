import type { ComponentType, PropsWithChildren } from 'react';

import { Empty } from '@onekeyhq/components';

const PageErrOccurred = ({ onPress }: { onPress?: () => void }) => (
  <Empty
    icon="ErrorOutline"
    title="An error occurred"
    description="We're unable to complete your request. Please refresh the page in a few minutes."
    buttonProps={{ onPress, children: 'Refresh' }}
  />
);

type IPageFrameProps = {
  loading?: boolean;
  LoadingSkeleton?: ComponentType<any>;
  error?: boolean;
  onRefresh?: () => void;
};

export const PageFrame = ({
  children,
  loading,
  LoadingSkeleton,
  error,
  onRefresh,
}: PropsWithChildren<IPageFrameProps>) => {
  if (loading) {
    return LoadingSkeleton ? <LoadingSkeleton /> : null;
  }
  if (error) {
    return <PageErrOccurred onPress={onRefresh} />;
  }
  return <>{children}</>;
};
