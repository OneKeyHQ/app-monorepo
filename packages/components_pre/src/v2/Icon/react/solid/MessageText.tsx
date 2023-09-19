import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgMessageText = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18.002 3h-12a3 3 0 0 0-3 3v10.036a3 3 0 0 0 3 3h2.65l2.704 2.266a1 1 0 0 0 1.28.004l2.74-2.27h2.626a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3ZM8 9a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H9Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageText;
