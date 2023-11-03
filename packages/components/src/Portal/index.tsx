import type { PropsWithChildren, ReactElement } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';

type PortalComponentsMapType = Map<string, ReactElement<{ name: string }>>;
const PortalComponentsMap: PortalComponentsMapType = new Map();

let onUpdateComponentsCallback: () => void;

function PortalComponent({ children }: PropsWithChildren<unknown>) {
  // disablee=d re-render at any time
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => children, []);
}

export const setPortalComponent = (
  component: ReactElement<{ name: string }>,
) => {
  PortalComponentsMap.set(
    component.props.name,
    <PortalComponent>{component}</PortalComponent>,
  );
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
}

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
