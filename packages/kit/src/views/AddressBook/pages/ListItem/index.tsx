import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, Page, XStack, useMedia } from '@onekeyhq/components';
import { showAddressSafeNotificationDialog } from '@onekeyhq/kit/src/components/AddressInput/AddressSafeDialog';
import { useIsEnableTransferAllowList } from '@onekeyhq/kit/src/components/AddressInput/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalAddressBookRoutes } from '@onekeyhq/shared/src/routes';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { ContentContainer } from '../../components/ContentContainer';
import { useAddressBookItems } from '../../hooks/useAddressBook';

function ListPage() {
  const intl = useIntl();
  const isEnableTransferAllowList = useIsEnableTransferAllowList();
  const { isLoading, result } = useAddressBookItems();
  const iconProps = useMemo(
    () =>
      isEnableTransferAllowList
        ? ({
            name: 'ShieldCheckDoneOutline',
            color: '$iconSuccess',
          } as const)
        : ({
            name: 'ShieldKeyholeOutline',
            color: '$icon',
          } as const),
    [isEnableTransferAllowList],
  );

  const navigation = useAppNavigation();
  const handleShowDialog = useCallback(async () => {
    await showAddressSafeNotificationDialog({
      intl,
    });
  }, [intl]);
  const onCreate = useCallback(() => {
    navigation.push(EModalAddressBookRoutes.EditItemModal);
  }, [navigation]);
  const { gtMd } = useMedia();
  const renderHeaderRightComponent = useCallback(
    () => (
      <XStack gap="$1.5">
        <IconButton
          variant="tertiary"
          icon={iconProps.name}
          iconProps={{
            color: iconProps.color,
          }}
          onPress={handleShowDialog}
        />
        {gtMd ? (
          <IconButton
            variant="tertiary"
            icon="PlusCircleOutline"
            onPress={onCreate}
            testID="address-book-add-icon"
          />
        ) : null}
      </XStack>
    ),
    [gtMd, handleShowDialog, iconProps.color, iconProps.name, onCreate],
  );
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.address_book_title })}
        headerRight={renderHeaderRightComponent}
      />
      <Page.Body>
        <ContentContainer
          loading={isLoading}
          error={Boolean(!isLoading && !result)}
          unsafe={result?.isSafe === false}
        >
          <AddressBookListContent items={result?.items ?? []} showActions />
        </ContentContainer>
      </Page.Body>
      {gtMd ? null : <Page.Footer onConfirm={onCreate} />}
    </Page>
  );
}

export default ListPage;
