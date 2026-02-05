import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightRain = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.605 18.053a1 1 0 0 1 1.79.894l-1 2a1 1 0 0 1-1.79-.894zM3 9.5a6.5 6.5 0 0 1 11.9-3.62c.066.1.235.19.425.165A5 5 0 1 1 16 16h-4.632l-.973 1.947a1 1 0 0 1-1.79-.894l.532-1.065A6.5 6.5 0 0 1 3 9.5m2 0A4.5 4.5 0 0 0 9.5 14H16a3 3 0 1 0-.406-5.973c-.873.118-1.823-.24-2.355-1.032A4.5 4.5 0 0 0 5 9.5" />
  </Svg>
);
export default SvgLightRain;
