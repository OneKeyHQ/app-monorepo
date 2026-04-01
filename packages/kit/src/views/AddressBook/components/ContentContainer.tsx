import type { PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Spinner, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const ContentSpinner = () => (
  <Stack h="100%" justifyContent="center" alignItems="center">
    <Spinner size="large" />
  </Stack>
);

const ErrOccurred = () => {
  const intl = useIntl();
  return (
    <Empty
      icon="ErrorOutline"
      title={intl.formatMessage({ id: ETranslations.global_an_error_occurred })}
      description={intl.formatMessage({
        id: ETranslations.global_an_error_occurred,
      })}
    />
  );
};

type IContentContainerProps = {
  loading?: boolean;
  error?: boolean;
  onRefresh?: () => void;
};

export const ContentContainer = ({
  children,
  loading,
  error,
}: PropsWithChildren<IContentContainerProps>) => {
  if (loading) {
    return <ContentSpinner />;
  }
  if (error) {
    return <ErrOccurred />;
  }
  return <>{children}</>;
};
