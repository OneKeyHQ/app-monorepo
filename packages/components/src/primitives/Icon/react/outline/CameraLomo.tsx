import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraLomo = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path d="M7.01 8a1 1 0 0 1 0 2H7a1 1 0 0 1 0-2z" />
    <Path
      fillRule="evenodd"
      d="M9.914 4H22v16H2V4h2.086l1-1h3.828zm-5 2H4v12h16V6H9.086l-1-1H5.914z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraLomo;
