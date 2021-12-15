import React from 'react';
import { Center, Searchbar, Stack } from '@onekeyhq/components';

const SearchbarGallery = () => (
  <Center flex="1" bg="background-hovered">
    <Stack space="2">
      <Searchbar />
      <Searchbar small />
    </Stack>
  </Center>
);

export default SearchbarGallery;
