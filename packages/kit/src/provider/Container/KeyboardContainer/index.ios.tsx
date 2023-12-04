import { useLayoutEffect } from 'react';

import { useIntl } from 'react-intl';
import KeyboardManager from 'react-native-keyboard-manager';

export function KeyboardContainer() {
  const intl = useIntl();

  useLayoutEffect(() => {
    // 暂时关闭 IQKeyboardManager, 因为 Modal 上的 textField 会让最底层的 View 跟着键盘移动
    KeyboardManager.setEnable(false);
    KeyboardManager.setEnableDebugging(false);
    KeyboardManager.setKeyboardDistanceFromTextField(10);
    KeyboardManager.setLayoutIfNeededOnUpdate(true);
    KeyboardManager.setEnableAutoToolbar(true);
    KeyboardManager.setToolbarDoneBarButtonItemText(
      intl.formatMessage({ id: 'action__done' }),
    );
    KeyboardManager.setToolbarPreviousNextButtonEnable(false);
    KeyboardManager.setKeyboardAppearance('default');
    KeyboardManager.setShouldPlayInputClicks(true);
  }, [intl]);
  return null;
}
