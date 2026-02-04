import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudy = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M1 12a8 8 0 0 1 14.883-4.079c.046.077.169.152.315.132A6 6 0 1 1 17 20H9a8 8 0 0 1-8-8m8-6a6 6 0 1 0 0 12h8a4 4 0 1 0-.537-7.964c-.881.117-1.815-.278-2.3-1.094A6 6 0 0 0 9 6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCloudy;
