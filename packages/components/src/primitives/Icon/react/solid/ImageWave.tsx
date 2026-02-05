import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgImageWave = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17.492 9.002a2.499 2.499 0 1 1-4.997 0 2.499 2.499 0 0 1 4.997 0" />
    <Path
      fillRule="evenodd"
      d="M4.999 3.005H18.99c1.1 0 1.999.9 1.999 1.999v13.992c0 1.1-.9 1.999-1.999 1.999H5c-1.1 0-1.999-.9-1.999-1.999V5.004c0-1.1.9-1.999 1.999-1.999ZM18.99 12.83V5.003H5v7.216l1.27-.95.02-.02a2.99 2.99 0 0 1 3.857.45c1.47 1.58 2.938 2.749 4.847 2.749 1.7 0 2.859-.56 3.998-1.62Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgImageWave;
