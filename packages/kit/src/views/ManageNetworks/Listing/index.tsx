import React, { FC, useState } from 'react';

import { ListView } from './ListView';
import { SortableView } from './SortableView';

export const Listing: FC = () => {
  const [editable, setEditable] = useState(false);
  return editable ? (
    <SortableView onPress={() => setEditable(false)} />
  ) : (
    <ListView onPress={() => setEditable(true)} />
  );
};

export default Listing;
