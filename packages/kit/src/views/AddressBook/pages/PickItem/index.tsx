import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAddressBookRoutes,
  IModalAddressBookParamList,
} from '@onekeyhq/shared/src/routes/addressBook';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { ContentContainer } from '../../components/ContentContainer';
import { useAddressBookItems } from '../../hooks/useAddressBook';

import type { IAddressItem } from '../../type';
import type { RouteProp } from '@react-navigation/core';

const PickItemPage = () => {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalAddressBookParamList,
        EModalAddressBookRoutes.PickItemModal
      >
    >();
  const { onPick, networkId } = route.params;
  const { isLoading, result, run } = useAddressBookItems(networkId);
  const navigation = useAppNavigation();

  const onPressItem = useCallback(
    async (item: IAddressItem) => {
      onPick?.(item);
      navigation.pop();
    },
    [onPick, navigation],
  );
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.address_book_select_title,
        })}
      />
      <Page.Body>
        <ContentContainer
          loading={isLoading}
          error={Boolean(!isLoading && !result)}
          unsafe={Boolean(result && !result.isSafe)}
          onRefresh={run}
        >
          <AddressBookListContent
            onPressItem={onPressItem}
            items={result?.items ?? []}
            hideEmptyAddButton
          />
        </ContentContainer>
      </Page.Body>
    </Page>
  );
};

export default PickItemPage;
