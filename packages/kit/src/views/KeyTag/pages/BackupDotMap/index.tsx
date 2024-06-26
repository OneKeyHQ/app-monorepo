import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { IconButton, Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { DotMap } from '@onekeyhq/kit/src/components/DotMap';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalKeyTagParamList } from '@onekeyhq/shared/src/routes';
import { EModalKeyTagRoutes } from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

const BackupDotMap = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalKeyTagParamList, EModalKeyTagRoutes.BackupDotMap>
    >();

  const { encodedText, title } = route.params;
  const { result } = usePromiseResult(
    () =>
      backgroundApiProxy.servicePassword.decodeSensitiveText({ encodedText }),
    [encodedText],
  );
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(
    () => (
      <IconButton
        icon="QuestionmarkOutline"
        variant="tertiary"
        onPress={() => {
          appNavigation.push(EModalKeyTagRoutes.BackupDocs);
        }}
      />
    ),
    [appNavigation],
  );
  return (
    <Page scrollEnabled>
      <Page.Header title={title} headerRight={headerRight} />
      <Page.Body>
        <YStack alignItems="center">
          {result ? <DotMap mnemonic={result} /> : null}
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_i_got_it,
        })}
        confirmButtonProps={{
          variant: 'primary',
          onPress: () => {
            appNavigation.popStack();
          },
        }}
      />
    </Page>
  );
};

export default BackupDotMap;
