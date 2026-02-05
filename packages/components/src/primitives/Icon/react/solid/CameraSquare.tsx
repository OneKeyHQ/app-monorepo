import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCameraSquare = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm4.5 9a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0m9-3.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraSquare;
