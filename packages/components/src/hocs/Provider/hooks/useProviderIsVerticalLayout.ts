import { createContext, useContext } from 'react';

export const ContextIsVerticalLayout = createContext<boolean>(false);

const useProviderIsVerticalLayout = () => useContext(ContextIsVerticalLayout);
export default useProviderIsVerticalLayout;
