import platformEnv from '../platformEnv';

import type { ViewStyle } from 'react-native';

/*
-          borderCurve="continuous"
+          {...rnUtils.fixProps({
+            borderCurve: 'continuous',
+          })}
*/
function fixProps(props: ViewStyle) {
  if (platformEnv.isRuntimeBrowser) {
    const newProps = { ...props };
    delete newProps.borderCurve;
    return newProps;
  }
  return props;
}

export default { fixProps };
