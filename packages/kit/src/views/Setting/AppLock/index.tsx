import { useState } from 'react';

import { Page, Stack } from '@onekeyhq/components';

import { ListItemSelect } from '../Components/ListItemSelect';

const options = [
  {
    title: 'Immediately',
    value: '0',
  },
  {
    title: '1 min',
    value: '1',
  },
  {
    title: '5 min',
    value: '2',
  },
  {
    title: '30 min',
    value: '3',
  },
  {
    title: '1 hr',
    value: '4',
  },
];
const AppLock = () => {
  const [value, setValue] = useState('0');
  return (
    <Page>
      <Stack py="$2">
        <ListItemSelect onChange={setValue} value={value} options={options} />
      </Stack>
    </Page>
  );
};

export default AppLock;
