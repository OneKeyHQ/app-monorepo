import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

type PortalComponentsMapType = Map<string, ReactElement<{ name: string }>>;
const PortalComponentsMap: PortalComponentsMapType = new Map();

let onUpdateComponentsCallback: () => void;

export const setPortalComponent = (
  component: ReactElement<{ name: string }>,
) => {
  PortalComponentsMap.set(component.props.name, component);
  onUpdateComponentsCallback();
};

export const removePortalComponent = (name: string) => {
  if (PortalComponentsMap.size === 0) {
    return;
  }
  PortalComponentsMap.delete(name);
  // Remove the React node after the animation has finished.
  setTimeout(() => {
    onUpdateComponentsCallback();
  }, 300);
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
  return <>{[...PortalComponentsMap.values()]}</>;
}
