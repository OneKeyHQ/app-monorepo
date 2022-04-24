import type { DesktopRef } from '../Select/Container/Desktop';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const MARK_ID_FOR_SELECT_HIDE = 'mark-id-for-select-hide'

let mainScreenDom: HTMLElement | null = null
if (platformEnv.isBrowser) {
  window.setTimeout(() => {
    mainScreenDom = document.getElementById(MARK_ID_FOR_SELECT_HIDE);
  }, 3000);
}


let desktopRefs: DesktopRef[] = [];

// function domContains(root: HTMLElement, n: HTMLElement) {
//   let node = n;
//   while (node) {
//     if (node === root) {
//       return true;
//     }
//     node = node.parentNode as HTMLElement;
//   }
//   return false;
// }

export function addNewRef(newRef: DesktopRef) {
  desktopRefs.push(newRef);
}

export function removeOldRef(oldRef: DesktopRef | null) {
  desktopRefs = desktopRefs.filter((r) => r !== oldRef);
}

function isAccountSelector(name: string): boolean {
  return name.indexOf('AccountSelectorDesktop') !== -1
}

export function autoHideSelectFunc(event: any) {
  if (platformEnv.isBrowser) {
    for (let t of desktopRefs) {
      // console.log('domid=', t.domId, ' ', t.getVisible())
      if (t.getVisible() === true) {
        const container = document.getElementById(t.domId);
        if (isAccountSelector(t.domId)) {
          //是那个非常特别的SELECT
          if (mainScreenDom?.contains(event.target)) {
            if (
              event &&
              container &&
              event.target &&
              container.contains(event.target as HTMLElement)
            ) {
              // console.log('inner click, return')
              //点击发生在 panel内部，不收起panel
              continue;
            }
          } else {
            //点击不是发生在主屏幕上，而是在MODAL，SELECT PANEL上
            continue;
          }
        } else {
          //普通的SELECT
          if (
            event &&
            container &&
            event.target &&
            container.contains(event.target as HTMLElement)
          ) {
            // console.log('inner click, return')
            //点击发生在SELECT panel内部，不收起panel
            continue;
          }
        }
        t.toggleVisible();
      }
    }
  }
}

if (platformEnv.isBrowser) {
  document.addEventListener('click', autoHideSelectFunc)
}