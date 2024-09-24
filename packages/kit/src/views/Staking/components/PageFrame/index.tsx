import type { ComponentType, PropsWithChildren } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Skeleton, Stack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const PageErrOccurred = ({ onPress }: { onPress?: () => void }) => {
  const intl = useIntl();
  return (
    <Empty
      pt="$32"
      icon="ErrorOutline"
      title={intl.formatMessage({ id: ETranslations.global_an_error_occurred })}
      description={intl.formatMessage({
        id: ETranslations.global_an_error_occurred_desc,
      })}
      buttonProps={{
        onPress,
        children: intl.formatMessage({ id: ETranslations.global_refresh }),
      }}
    />
  );
};

type IPageFrameProps = {
  loading?: boolean;
  LoadingSkeleton?: ComponentType<any>;
  error?: boolean;
  onRefresh?: () => void;
};

export const SimpleSpinnerSkeleton = () => (
  <Stack>
    <Stack px="$5" py="$2">
      <Skeleton.HeadingSm />
    </Stack>
    {Array.from({ length: 3 }).map((_, index) => (
      <ListItem key={index}>
        <Skeleton h="$10" w="$10" radius="round" />
        <Stack>
          <Skeleton.BodyLg />
          <Skeleton.BodyMd />
        </Stack>
      </ListItem>
    ))}
  </Stack>
);

export const isLoadingState = ({
  result,
  isLoading,
}: {
  result: unknown;
  isLoading: boolean | undefined;
}) =>
  Boolean(
    result === undefined && (isLoading === undefined || isLoading === true),
  );

export const isErrorState = ({
  result,
  isLoading,
}: {
  result: unknown;
  isLoading: boolean | undefined;
}) => Boolean(result === undefined && isLoading === false);

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
