import React from 'react';

let resolveCallback: ((value: boolean) => void) | undefined;
function useConfirm() {
  const [visible, setVisible] = React.useState<boolean>(false);

  const closeConfirm = () => {
    setVisible(false);
  };

  const onConfirm = () => {
    closeConfirm();
    resolveCallback?.(true);
  };

  const onCancel = () => {
    closeConfirm();
    resolveCallback?.(false);
  };
  const confirm = () => {
    setVisible(true);
    return new Promise((res: (value: boolean) => void) => {
      resolveCallback = res;
    });
  };

  return { confirm, onConfirm, onCancel, closeConfirm, visible };
}

export default useConfirm;
