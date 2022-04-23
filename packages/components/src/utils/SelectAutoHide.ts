import type { DesktopRef } from '../Select/Container/Desktop';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

let desktopRefs: DesktopRef[] = [];

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

export function addNewRef(newRef: DesktopRef) {
  desktopRefs.push(newRef);
}

export function removeOldRef(oldRef: DesktopRef | null) {
  desktopRefs = desktopRefs.filter((r) => r !== oldRef);
}

export function autoHideSelectFunc(event: any) {
  if (platformEnv.isBrowser) {
    for (let t of desktopRefs) {
      // console.log('domid=', t.domId, ' ', t.getVisible())
      if (t.getVisible() === true) {
        const container = document.getElementById(t.domId);
        if (
          event &&
          container &&
          event.target &&
          domContains(container, event.target as HTMLElement)
        ) {
          // console.log('inner click, return')
          return;
        }
        t.toggleVisible()
      }
    }
  }
}

if (platformEnv.isBrowser) {
  document.addEventListener('click', autoHideSelectFunc)
}