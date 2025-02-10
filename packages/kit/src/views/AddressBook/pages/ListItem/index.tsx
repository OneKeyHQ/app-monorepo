import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ColorTokens, IKeyOfIcons } from '@onekeyhq/components';
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
  const { icon, iconColor } = useMemo(() => {
    if (isEnableTransferAllowList) {
      return {
        icon: 'ShieldCheckDoneSolid',
        iconColor: '$iconSuccess',
      };
    }
    return {
      icon: 'ShieldOutline',
      iconColor: '$iconSubdued',
    };
  }, [isEnableTransferAllowList]);

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
      <XStack gap="$3.5">
        <IconButton
          variant="tertiary"
          icon={icon as IKeyOfIcons}
          iconProps={{
            color: iconColor as ColorTokens,
          }}
          onPress={handleShowDialog}
        />
        {gtMd ? (
          <IconButton
            variant="tertiary"
            icon="AddPeopleOutline"
            onPress={onCreate}
            testID="address-book-add-icon"
          />
        ) : null}
      </XStack>
    ),
    [gtMd, handleShowDialog, icon, iconColor, onCreate],
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
      {gtMd ? null : (
        <Page.Footer
          onConfirm={onCreate}
          onConfirmText={intl.formatMessage({
            id: ETranslations.address_book_add_address_title,
          })}
        />
      )}
    </Page>
  );
}

export default ListPage;
