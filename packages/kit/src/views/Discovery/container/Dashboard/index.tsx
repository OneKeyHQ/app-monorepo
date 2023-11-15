import { useCallback } from 'react';

import { Button, YStack } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { ETabRoutes } from '../../../../routes/Root/Tab/Routes';
import { onItemSelect as onDAppItemSelect } from '../../utils/gotoSite';

import type { IDAppItemType } from '../../types';

const data = [
  {
    'url': 'https://www.onekey111.so/',
    'name': 'ErrorPage',
    '_id': '64086c61ea3412b877c2d8de',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1678273561733.0.26599601397534145.0.png',
  },
  {
    'url': 'http://www.onekey111danger.so/',
    'name': 'DangerPage',
    '_id': '64082361ea3412b877c2d8de',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1678273561733.0.26599601397534145.0.png',
  },
  {
    'url': 'https://8571e594.n0p.online/db1728.html',
    'name': '慢雾测试',
    '_id': '64022361ea3412b877c2d8de',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1678273561733.0.26599601397534145.0.png',
  },
  {
    'url': 'https://dapp-example.onekeytest.com/',
    'name': 'DApp Example',
    '_id': '645b6b8203be4e9f3e9932c',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1683712871498.0.9361315179110976.0.png',
  },
  {
    'url': 'https://webln.twentyuno.net/info',
    'name': 'WebLN Experiments',
    '_id': '645b6b8203be4e9f3421932c',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1683712871498.0.9361315179110976.0.png',
  },
  {
    'url': 'https://helio.money/app/loans/',
    'name': 'Helio Protocol',
    '_id': '645b6b8203be4e9f3e99130b',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1683712871498.0.9361315179110976.0.png',
  },
  {
    'url': 'https://agilitylsd.com/',
    'name': 'Agility',
    '_id': '643e73d5223e5099ac7fa67e',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1681814481583.0.10849986891361785.0.png',
  },
  {
    'url': 'https://cryptoskyland.com/#/index??utm_source=onekey',
    'name': 'CryptoSkyland',
    '_id': '634fa07920ec3e25ecd1ff74',
    'logoURL':
      'https://nft.onekey-asset.com/admin/u_b_956c13b0-38a9-11ed-8a53-c14e5b2d68f4.jpeg.jpeg',
  },
  {
    'url': 'https://arbitrum.foundation',
    'name': 'Arbitrum Foundation',
    '_id': '64199bbacbfe888538c3c772',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1679399863339.0.7540050077875533.0.jpeg',
  },
  {
    'url': 'https://www.carrier.so/',
    'name': 'Carrier',
    '_id': '64086c61ea3412b877c208de',
    'logoURL':
      'https://nft.onekey-asset.com/admin/upload_1678273561733.0.26599601397534145.0.png',
  },
];

type IProps = { onItemSelect?: (item: IDAppItemType) => void };

function Dashboard({ onItemSelect }: IProps) {
  const navigation = useAppNavigation();
  const handlerItemSelect = useCallback(
    (item: IDAppItemType) => {
      if (onItemSelect) {
        onItemSelect(item);
      } else {
        onDAppItemSelect(item, true);
        navigation.switchTab(ETabRoutes.MultiTabBrowser);
      }
    },
    [onItemSelect, navigation],
  );
  return (
    <YStack h={500} bg="red">
      {data.map((i) => (
        <Button
          key={i._id}
          onPress={() => {
            handlerItemSelect(i as IDAppItemType);
          }}
        >
          {i.name}
        </Button>
      ))}
    </YStack>
  );
}

export default Dashboard;
