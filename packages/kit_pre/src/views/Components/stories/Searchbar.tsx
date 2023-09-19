import { useState } from 'react';

import { Center, Searchbar, Stack } from '@onekeyhq/components';

const SearchbarGallery = () => {
  const [value, setValue] = useState('');
  const [, setValue1] = useState('');
  return (
    <Center flex="1" bg="background-hovered">
      <Stack space="2">
        <Searchbar value="read only" />
        <Searchbar />
        <Searchbar
          value={value}
          onChangeText={(text) => setValue(text)}
          onClear={() => setValue('')}
        />
        <Searchbar onChangeText={(text) => setValue1(text)} />
      </Stack>
    </Center>
  );
};

export default SearchbarGallery;
