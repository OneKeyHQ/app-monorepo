import { useState } from 'react';

import { Input, Toast } from '@onekeyhq/components';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { urlAccountNavigation } from '../../views/Home/pages/urlAccount/urlAccountUtils';

export function UniversalSearchInput() {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const [val, setVal] = useState('');
  const navigation = useAppNavigation();
  return (
    <Input
      size="small"
      key="searchInput"
      placeholder="Search"
      value={val}
      onChangeText={setVal}
      onKeyPress={async (e) => {
        // TODO web only?
        const isPressEnter = (e as unknown as { key: string }).key === 'Enter';
        if (isPressEnter) {
          const input = val?.trim?.() || '';
          const result = await backgroundApiProxy.serviceApp.universalSearch({
            input,
            networkId: activeAccount?.network?.id,
            searchTypes: [EUniversalSearchType.Address],
          });
          const firstAddressItemPayload =
            result?.[EUniversalSearchType.Address]?.items?.[0]?.payload;
          console.log(input, result);
          if (firstAddressItemPayload) {
            const { network, addressInfo } = firstAddressItemPayload;
            urlAccountNavigation.pushUrlAccountPage(navigation, {
              address: addressInfo.displayAddress,
              networkId: network.id,
            });
            setVal('');
          } else {
            Toast.error({
              title: 'No result found',
            });
          }
        }
      }}
    />
  );
}
