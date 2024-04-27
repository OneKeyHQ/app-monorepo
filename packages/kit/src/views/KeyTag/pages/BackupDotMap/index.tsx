import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';

import { IconButton, Page, YStack } from '@onekeyhq/components';
import { decodeSensitiveText } from '@onekeyhq/core/src/secret';
import { DotMap } from '@onekeyhq/kit/src/components/DotMap';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IModalKeyTagParamList } from '@onekeyhq/shared/src/routes';
import { EModalKeyTagRoutes } from '@onekeyhq/shared/src/routes';

import type { RouteProp } from '@react-navigation/core';

const BackupDotMap = () => {
  const route =
    useRoute<
      RouteProp<IModalKeyTagParamList, EModalKeyTagRoutes.BackupDotMap>
    >();

  const { encodedText, title } = route.params;
  const data = useMemo(
    () => decodeSensitiveText({ encodedText }),
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
          <DotMap mnemonic={data} />
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText="I've Saved the Phrase"
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
