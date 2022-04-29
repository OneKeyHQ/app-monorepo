import { useEffect, useMemo } from 'react';

import uuid from 'react-native-uuid';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

function domContains(root: HTMLElement, n: HTMLElement) {
  let node = n;
  while (node) {
    if (node === root) {
      return true;
    }
    node = node.parentNode as HTMLElement;
  }
  return false;
}

function useDomID(name: string) {
  const domId = useMemo(() => `${name}-${uuid.v4() as string}`, [name]);
  return { domId };
}

export default function useClickDocumentClose({
  name,
  visible,
  toggleVisible,
}: {
  name: string;
  visible: boolean;
  toggleVisible?: (...args: any) => any;
}): { domId: string } {
  const domId = useMemo(() => `${name}-${uuid.v4() as string}`, [name]);

  useEffect(() => {
    const documentClick = (event: MouseEvent) => {
      if (!visible || !toggleVisible) {
        return;
      }
      const container = document.getElementById(domId);
      if (
        container &&
        event.target &&
        domContains(container, event.target as HTMLElement)
      ) {
        return;
      }
      setTimeout(() => {
        if (!visible) {
          return;
        }
        const ele = document.getElementById(domId);
        // element may be hidden already
        if (!ele) {
          return;
        }
        // console.log(`${name}: toggleVisible`, domId);
        toggleVisible();
      }, 150);
    };
    if (platformEnv.isBrowser) {
      window.addEventListener('click', documentClick);
    }
    return () => {
      if (platformEnv.isBrowser) {
        window.removeEventListener('click', documentClick);
      }
    };
  }, [domId, toggleVisible, visible]);

  return { domId };
}

export { useDomID };
