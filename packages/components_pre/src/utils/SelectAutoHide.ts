import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { DesktopRef } from '../Select/Container/Desktop';

export const MARK_ID_FOR_SELECT_HIDE = 'mark-id-for-select-hide';

let mainScreenDom: HTMLElement | null = null;

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

export function setMainScreenDom(dom: HTMLElement | null) {
  // 没有组件卸载场景
  if (platformEnv.isRuntimeBrowser) {
    mainScreenDom = dom;
  }
}

export function addNewRef(newRef: DesktopRef) {
  desktopRefs.push(newRef);
}

export function removeOldRef(oldRef: DesktopRef | null) {
  desktopRefs = desktopRefs.filter((r) => r !== oldRef);
}

function isAccountSelector(name: string): boolean {
  return name.indexOf('AccountSelectorDesktop') !== -1;
}

export function autoHideSelectFunc(event: MouseEvent) {
  if (platformEnv.isRuntimeBrowser) {
    for (const t of desktopRefs) {
      if (t.getVisible() === true) {
        const container = document.getElementById(t.domId);
        let shouldHide = true;
        if (isAccountSelector(t.domId)) {
          // 是那个非常特别的SELECT
          if (
            mainScreenDom &&
            domContains(mainScreenDom, event.target as HTMLElement)
          ) {
            if (
              event &&
              container &&
              event.target &&
              domContains(container, event.target as HTMLElement)
            ) {
              // 点击发生在 panel内部，不收起panel
              shouldHide = false;
            }
          } else {
            // 点击不是发生在主屏幕上，而是在MODAL，SELECT PANEL上
            shouldHide = false;
          }
        } else {
          // 普通的SELECT
          shouldHide = true;
          if (
            event &&
            container &&
            event.target &&
            domContains(container, event.target as HTMLElement)
          ) {
            // 点击发生在SELECT panel内部，不收起panel
            shouldHide = false;
          }
        }
        if (shouldHide) {
          t.toggleVisible();
        }
      }
    }
  }
}

if (platformEnv.isRuntimeBrowser) {
  document.addEventListener('click', autoHideSelectFunc);
}
