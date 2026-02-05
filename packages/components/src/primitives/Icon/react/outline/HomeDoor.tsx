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
      d="M12 8.324a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M11.135 1.917a2 2 0 0 1 1.845.061l7 3.938A2 2 0 0 1 21 7.659v11.165a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.659a2 2 0 0 1 1.02-1.743l7-3.938zM5 7.66v11.165h14V7.659L12 3.72z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHomeDoor;
