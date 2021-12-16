import { createContext } from 'react';

import stores from '../stores';

const StoresContext = createContext({
  ...stores,
});

export { StoresContext as default };
