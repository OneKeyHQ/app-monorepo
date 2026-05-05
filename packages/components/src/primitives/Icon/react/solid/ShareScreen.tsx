import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShareScreen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM7.586 11.5 9 12.914l2-2V16.5h2v-5.586l2 2 1.414-1.414L12 7.086z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShareScreen;
