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
      d="M8.086 3a2 2 0 0 1 1.414.586L9.914 4H20a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h.086l.414-.414A2 2 0 0 1 5.914 3zM5.5 5.414A2 2 0 0 1 4.086 6H4v12h16V6H9.914A2 2 0 0 1 8.5 5.414L8.086 5H5.914z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCameraLomo;
