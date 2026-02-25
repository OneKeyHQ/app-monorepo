import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraLomo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4" />
    <Path
      fillRule="evenodd"
      d="m8.914 3 1 1H22v16H2V4h2.086l1-1zM14 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M7 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraLomo;
