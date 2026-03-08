import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShareScreen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.414 11.5 15 12.914l-2-2V16.5h-2v-5.586l-2 2L7.586 11.5 12 7.086z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShareScreen;
