import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgControlKey = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm11.707 1.293a1 1 0 0 0-1.414 0l-2 2a1 1 0 0 0 1.414 1.414L14 9.414l1.293 1.293a1 1 0 0 0 1.414-1.414l-2-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgControlKey;
