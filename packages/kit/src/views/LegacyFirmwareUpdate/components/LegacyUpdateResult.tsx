import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Icon,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ILegacyUpdateResultProps {
  success: boolean;
  error?: IOneKeyError | string;
  onRetry?: () => void;
  onClose?: () => void;
  needOnboarding?: boolean;
  onStartOnboarding?: () => void;
}

export function LegacyUpdateResult({
  success,
  error,
  onRetry,
  onClose,
  needOnboarding,
  onStartOnboarding,
}: ILegacyUpdateResultProps) {
  const intl = useIntl();

  const errorMessage = useMemo(() => {
    if (!error) return undefined;
    if (typeof error === 'string') return error;
    return error.message || 'Unknown error';
  }, [error]);

  if (success) {
    return (
      <YStack
        space="$6"
        alignItems="center"
        justifyContent="center"
        flex={1}
        py="$8"
        animation="medium"
        enterStyle={{
          opacity: 0,
          y: 20,
        }}
        opacity={1}
        y={0}
      >
        <Stack
          width="$16"
          height="$16"
          borderRadius="$full"
          backgroundColor="$bgSuccessStrong"
          alignItems="center"
          justifyContent="center"
          animation="quick"
          enterStyle={{
            scale: 0.5,
            opacity: 0,
          }}
          scale={1}
          opacity={1}
        >
          <Icon name="CheckLargeOutline" size="$8" color="$iconOnColor" />
        </Stack>

        <YStack
          space="$2"
          alignItems="center"
          animation="medium"
          enterStyle={{
            opacity: 0,
            y: 10,
          }}
          opacity={1}
          y={0}
        >
          <SizableText size="$headingXl" textAlign="center">
            {intl.formatMessage({ id: ETranslations.update_update_completed })}
          </SizableText>
          <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.update_updated_to_latest_version,
            })}
          </SizableText>
        </YStack>

        <Stack
          width="100%"
          maxWidth={300}
          mt="$4"
          animation="slow"
          enterStyle={{
            opacity: 0,
            y: 10,
          }}
          opacity={1}
          y={0}
        >
          {needOnboarding && onStartOnboarding ? (
            <Button variant="primary" size="large" onPress={onStartOnboarding}>
              {intl.formatMessage({ id: ETranslations.global_import_wallet })}
            </Button>
          ) : (
            <Button variant="primary" size="large" onPress={onClose}>
              {intl.formatMessage({ id: ETranslations.global_got_it })}
            </Button>
          )}
        </Stack>
      </YStack>
    );
  }

  return (
    <YStack
      space="$6"
      alignItems="center"
      justifyContent="center"
      flex={1}
      py="$8"
      animation="medium"
      enterStyle={{
        opacity: 0,
        y: 20,
      }}
      opacity={1}
      y={0}
    >
      <Stack
        width="$16"
        height="$16"
        borderRadius="$full"
        backgroundColor="$bgCriticalStrong"
        alignItems="center"
        justifyContent="center"
        animation="quick"
        enterStyle={{
          scale: 0.5,
          opacity: 0,
        }}
        scale={1}
        opacity={1}
      >
        <Icon name="CrossedLargeOutline" size="$8" color="$iconOnColor" />
      </Stack>

      <YStack
        space="$2"
        alignItems="center"
        animation="medium"
        enterStyle={{
          opacity: 0,
          y: 10,
        }}
        opacity={1}
        y={0}
      >
        <SizableText size="$headingXl" textAlign="center">
          {intl.formatMessage({ id: ETranslations.global_failed })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
          {intl.formatMessage({
            id: ETranslations.global_update_failed,
          })}
        </SizableText>
      </YStack>

      {errorMessage ? (
        <Stack
          animation="medium"
          enterStyle={{
            opacity: 0,
          }}
          opacity={1}
          width="100%"
        >
          <Alert
            type="critical"
            title={intl.formatMessage({
              id: ETranslations.global_details,
            })}
            description={errorMessage}
            fullBleed
          />
        </Stack>
      ) : null}

      <Stack
        width="100%"
        maxWidth={300}
        mt="$4"
        space="$3"
        animation="slow"
        enterStyle={{
          opacity: 0,
          y: 10,
        }}
        opacity={1}
        y={0}
      >
        {onRetry ? (
          <Button variant="primary" size="large" onPress={onRetry}>
            {intl.formatMessage({ id: ETranslations.global_retry })}
          </Button>
        ) : null}
        {onClose ? (
          <Button variant="secondary" size="large" onPress={onClose}>
            {intl.formatMessage({ id: ETranslations.global_close })}
          </Button>
        ) : null}
      </Stack>
    </YStack>
  );
}
