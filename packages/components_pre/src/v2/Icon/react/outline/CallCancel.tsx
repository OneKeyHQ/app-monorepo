import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgCallCancel = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M20.707 4.707a1 1 0 0 0-1.414-1.414l-8.456 8.456a12.05 12.05 0 0 1-.988-1.347c-.171-.271-.145-.691.176-1.012l.26-.26a2 2 0 0 0 .502-1.99l-.601-2.002A3 3 0 0 0 7.312 3H6.001C4.38 3 2.91 4.344 3.13 6.12a16.936 16.936 0 0 0 4.162 9.173l-4 4a1 1 0 1 0 1.414 1.414l16-16ZM8.71 13.876l.709-.709a14.057 14.057 0 0 1-1.26-1.696c-.741-1.172-.434-2.61.452-3.496l.26-.26-.6-2.002A1 1 0 0 0 7.311 5h-1.31c-.59 0-.937.456-.885.873a14.938 14.938 0 0 0 3.594 8.003Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M18.128 18.884a14.908 14.908 0 0 1-6.4-2.37l-1.44 1.44a16.908 16.908 0 0 0 7.593 2.915c1.776.221 3.12-1.25 3.12-2.869v-1.312a3 3 0 0 0-2.138-2.873l-2.003-.601a2 2 0 0 0-1.989.501l-.26.26a.906.906 0 0 1-.624.281l-1.536 1.536.079.05c1.171.74 2.61.434 3.495-.452l.26-.26 2.003.6a1 1 0 0 1 .712.958V18c0 .59-.456.936-.872.884Z"
    />
  </Svg>
);
export default SvgCallCancel;
