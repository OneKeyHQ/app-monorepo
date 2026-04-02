import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAnonymousHidden = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17 13a4 4 0 1 1-3.991 4.273 2 2 0 0 0-2.018 0 4 4 0 1 1-.392-2.02 4.02 4.02 0 0 1 2.802-.001A4 4 0 0 1 17 13M7 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4m10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4"
      clipRule="evenodd"
    />
    <Path d="M19.867 10H22v2H2v-2h2.133l1-7h13.734z" />
  </Svg>
);
export default SvgAnonymousHidden;
