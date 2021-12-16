import { useContext } from 'react';

import StoresContext from '../contexts';

const useStores = () => useContext(StoresContext);

export { useStores as default };
