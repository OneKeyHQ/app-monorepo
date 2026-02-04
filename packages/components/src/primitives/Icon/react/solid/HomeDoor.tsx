import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHomeDoor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.02 1.978a2 2 0 0 1 1.96 0l7 3.937A2 2 0 0 1 21 7.66v11.165a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.658a2 2 0 0 1 1.02-1.743zM8.5 12.324a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHomeDoor;
