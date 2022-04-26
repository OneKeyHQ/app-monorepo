import platformEnv from '@onekeyhq/shared/src/platformEnv';

type ModalDomManager = {
  modalRoot: HTMLElement | null;
  base: Element | null;
};

const modalDomManager: ModalDomManager = { modalRoot: null, base: null };

export function initModalDom() {
  if (platformEnv.isBrowser) {
    const modalRoot = document.createElement('DIV');
    modalRoot.setAttribute('id', 'modal-root-kaidon-wong');
    const base = document.querySelector('#root>div>div>div');
    modalDomManager.modalRoot = modalRoot;
    modalDomManager.base = base;
    base?.insertBefore(modalRoot, base.children[3]);
  }
}

export function adjustModalDom() {
  if (platformEnv.isBrowser) {
    modalDomManager.base?.insertBefore(
      modalDomManager.modalRoot as HTMLElement,
      modalDomManager.base.children[3],
    );
  }
}

export function maintainModalDom() {
  if (platformEnv.isBrowser) {
    if (modalDomManager.modalRoot !== null) {
      adjustModalDom();
    } else {
      initModalDom();
    }
  }
}

export { modalDomManager };
