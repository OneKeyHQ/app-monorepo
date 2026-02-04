import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCloudSimple = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M1 12a8 8 0 0 1 14.884-4.078c.045.076.168.151.314.132A6 6 0 1 1 17 20H9a8 8 0 0 1-8-8m2 0a6 6 0 0 0 6 6h8a4 4 0 1 0-.537-7.965c-.882.118-1.815-.277-2.299-1.093A6 6 0 0 0 3 12" />
  </Svg>
);
export default SvgCloudSimple;
