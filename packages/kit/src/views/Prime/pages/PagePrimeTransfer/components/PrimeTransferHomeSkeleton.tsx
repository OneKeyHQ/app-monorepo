import { useIntl } from 'react-intl';

import { Divider, Page, Skeleton, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function PrimeTransferHomeSkeleton() {
  const intl = useIntl();

  return (
    <>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.transfer_establish_connection,
        })}
      />

      <Stack px="$4" gap="$4">
        {/* Segment Control Skeleton */}
        <Skeleton h="$10" w="100%" borderRadius="$3" />

        {/* QR Code Area Skeleton */}
        <Stack alignItems="center" gap="$4">
          <Skeleton h="$64" w="$64" borderRadius="$2" />
          <Skeleton h="$4" w="$16" borderRadius="$1" />
        </Stack>

        {/* Pairing Code Section Skeleton */}
        <Stack gap="$2">
          <Skeleton h="$4" w="$24" borderRadius="$1" />
          <Skeleton h="$12" w="100%" borderRadius="$2" />
        </Stack>

        {/* Steps Section Skeleton */}
        <Stack gap="$3">
          {/* Step 1 */}
          <Stack flexDirection="row" alignItems="flex-start" gap="$3">
            <Skeleton h="$6" w="$6" borderRadius="$1" />
            <Stack flex={1} gap="$1">
              <Skeleton h="$4" w="$40" borderRadius="$1" />
            </Stack>
          </Stack>

          {/* Step 2 */}
          <Stack flexDirection="row" alignItems="flex-start" gap="$3">
            <Skeleton h="$6" w="$6" borderRadius="$1" />
            <Stack flex={1} gap="$1">
              <Skeleton h="$4" w="$48" borderRadius="$1" />
              <Skeleton h="$4" w="$32" borderRadius="$1" />
            </Stack>
          </Stack>

          {/* Step 3 */}
          <Stack flexDirection="row" alignItems="flex-start" gap="$3">
            <Skeleton h="$6" w="$6" borderRadius="$1" />
            <Stack flex={1} gap="$1">
              <Skeleton h="$4" w="$44" borderRadius="$1" />
            </Stack>
          </Stack>
        </Stack>

        <Divider />

        {/* Description Skeleton */}
        <Stack gap="$2">
          <Skeleton h="$3" w="100%" borderRadius="$1" />
          <Skeleton h="$3" w="$56" borderRadius="$1" />
          <Skeleton h="$3" w="$48" borderRadius="$1" />
        </Stack>

        <Stack gap="$2">
          <Skeleton h="$3" w="$52" borderRadius="$1" />
          <Skeleton h="$3" w="$40" borderRadius="$1" />
        </Stack>

        <Stack h="$4" />
      </Stack>
    </>
  );
}
