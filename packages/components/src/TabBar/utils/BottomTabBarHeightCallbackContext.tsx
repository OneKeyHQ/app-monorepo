import React from 'react';

export default React.createContext<((height: number) => void) | undefined>(
  undefined,
);
