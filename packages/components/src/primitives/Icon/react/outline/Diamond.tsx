import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDiamond = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m10.914 8-2 2 2 2L9.5 13.414 6.086 10 9.5 6.586z" />
    <Path
      fillRule="evenodd"
      d="M23.914 10 12 21.914.086 10l7-7h9.828zm-21 0L12 19.086 21.086 10l-5-5H7.914z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDiamond;
