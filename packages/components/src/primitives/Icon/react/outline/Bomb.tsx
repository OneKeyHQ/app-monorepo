import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBomb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m18.414 7-2.097 2.096a8 8 0 1 1-1.414-1.414L17 5.586zM10 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12"
      clipRule="evenodd"
    />
    <Path d="M23 8h-3V6h3zm-.586-5L20 5.414 18.586 4 21 1.586zM18 4h-2V1h2z" />
  </Svg>
);
export default SvgBomb;
