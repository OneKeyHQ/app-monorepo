import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFeatures = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10.414 16 5 21.414 3.586 20 9 14.586zm7 0L12 21.414 10.586 20 16 14.586zm-9-5L3 16.414 1.586 15 7 9.586zm9.699-6.597 4.938 1.144-3.323 3.827.439 5.049-4.667-1.977-4.666 1.977.437-5.049L7.95 5.547l4.938-1.144L15.5.061z" />
  </Svg>
);
export default SvgFeatures;
