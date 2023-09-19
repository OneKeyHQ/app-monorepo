import { createContext } from 'react';

export default createContext<((height: number) => void) | undefined>(undefined);
