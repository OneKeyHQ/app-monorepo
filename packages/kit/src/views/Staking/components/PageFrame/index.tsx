import type { ComponentType, PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';

import { Empty } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const PageErrOccurred = ({ onPress }: { onPress?: () => void }) => {
  const intl = useIntl();
  return (
    <Empty
      icon="ErrorOutline"
      title={intl.formatMessage({ id: ETranslations.global_an_error_occurred })}
      description="We're unable to complete your request. Please refresh the page in a few minutes."
      buttonProps={{ onPress, children: 'Refresh' }}
    />
  );
};

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
