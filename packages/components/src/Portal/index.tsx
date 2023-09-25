import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { InteractionManager } from 'react-native';

const PortalComponents: ReactElement<{ name: string }>[] = [];

let onUpdateComponentsCallback: () => void;

export const setPortalComponent = (component: ReactElement) => {
  PortalComponents.push(component);
  onUpdateComponentsCallback();
};

export const removePortalComponent = (name: string) => {
  if (PortalComponents.length === 0) {
    return;
  }
  InteractionManager.runAfterInteractions(() => {
    const index = PortalComponents.findIndex((c) => c.props.name === name);
    PortalComponents.splice(index, 1);
    onUpdateComponentsCallback();
  });
};

const onUpdateComponents = (callback: () => void) => {
  onUpdateComponentsCallback = callback;
};

export function Portal() {
  const [, setNum] = useState(0);
  useEffect(() => {
    onUpdateComponents(() => {
      setNum((number) => number + 1);
    });
  }, []);
  return <>{PortalComponents}</>;
}
