import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgDice6 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
    />
    <Path
      fill="currentColor"
      d="M9.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0-8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm8 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0-8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
  </Svg>
);
export default SvgDice6;
