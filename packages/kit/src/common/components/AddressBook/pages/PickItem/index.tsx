import { useState } from 'react';

import { Page } from '@onekeyhq/components';

import { AddressBookListContent } from '../../components/AddressBookListContent';
import { sections } from '../../components/data';

const PickItemPage = () => {
  const [searchKey, setSearchKey] = useState<string>('');
  return (
    <Page>
      <Page.Header
        title="Select Address"
        headerSearchBarOptions={{
          placeholder: 'Search',
          onChangeText(e) {
            setSearchKey(e.nativeEvent.text);
          },
        }}
      />
      <Page.Body px="$4">
        <AddressBookListContent
          sections={sections}
          searchKey={searchKey.trim()}
        />
      </Page.Body>
    </Page>
  );
};

export default PickItemPage;
