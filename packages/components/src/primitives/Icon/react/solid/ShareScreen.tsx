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
      d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm9.293 1.793a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1-1.414 1.414L13 10.914V15.5a1 1 0 1 1-2 0v-4.586l-1.293 1.293a1 1 0 0 1-1.414-1.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShareScreen;
