import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLab2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m21.211 10.793-1.414 1.414-.793-.793-9.297 9.294a4.536 4.536 0 1 1-6.413-6.415L12.59 5l-.793-.793 1.414-1.414zM8.416 12h7.173l2-2-3.585-3.586z"
      clipRule="evenodd"
    />
    <Path d="M20.004 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2m-1.5-4a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
  </Svg>
);
export default SvgLab2;
