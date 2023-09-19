import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgPlusSm = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 20 20"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10 5a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2h-3v3a1 1 0 1 1-2 0v-3H6a1 1 0 1 1 0-2h3V6a1 1 0 0 1 1-1z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPlusSm;
