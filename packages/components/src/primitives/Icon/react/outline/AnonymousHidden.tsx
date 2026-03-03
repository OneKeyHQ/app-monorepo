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
      d="M17 13a4 4 0 1 1-3.99 4.273 2 2 0 0 0-2.02.001A3.999 3.999 0 0 1 3 17a4 4 0 0 1 7.599-1.747 4 4 0 0 1 2.801 0A4 4 0 0 1 17 13M7 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4m10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4m2.868-5H22v2H2v-2h2.132l1-7h13.735zM6.153 10h11.694l-.714-5H6.867z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnonymousHidden;
