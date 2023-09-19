import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgSunDown = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3 19a1 1 0 1 0 0 2v-2Zm18 2a1 1 0 1 0 0-2v2ZM7 16a1 1 0 1 0 2 0H7Zm8 0a1 1 0 1 0 2 0h-2ZM3 15a1 1 0 1 0 0 2v-2Zm1 2a1 1 0 1 0 0-2v2Zm16-2a1 1 0 1 0 0 2v-2Zm1 2a1 1 0 1 0 0-2v2Zm-3.514-6.908a1 1 0 1 0 1.286 1.532l-1.286-1.532Zm2.052.889a1 1 0 0 0-1.286-1.532l1.286 1.532ZM5.748 9.449a1 1 0 1 0-1.285 1.532l1.285-1.532Zm-.52 2.175a1 1 0 0 0 1.286-1.532L5.23 11.624ZM11 7a1 1 0 1 0 2 0h-2Zm2-5a1 1 0 1 0-2 0h2ZM9.707 4.293a1 1 0 0 0-1.414 1.414l1.414-1.414ZM12 8l-.707.707a1 1 0 0 0 1.414 0L12 8Zm3.707-2.293a1 1 0 0 0-1.414-1.414l1.414 1.414ZM3 21h18v-2H3v2Zm6-5a3 3 0 0 1 3-3v-2a5 5 0 0 0-5 5h2Zm3-3a3 3 0 0 1 3 3h2a5 5 0 0 0-5-5v2Zm-9 4h1v-2H3v2Zm17 0h1v-2h-1v2Zm-1.228-5.376.766-.643-1.286-1.532-.766.643 1.286 1.532Zm-14.31-.643.767.643 1.285-1.532-.766-.643-1.285 1.532ZM13 7V2h-2v5h2ZM8.293 5.707l3 3 1.414-1.414-3-3-1.414 1.414Zm4.414 3 3-3-1.414-1.414-3 3 1.414 1.414Z"
    />
  </Svg>
);
export default SvgSunDown;
