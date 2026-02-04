import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLightBulb = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 20a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2zm-5-3h4v-1h-4zm8-8a6 6 0 1 0-9.313 5h6.627A5.99 5.99 0 0 0 18 9m2 0a8 8 0 0 1-3.876 6.856q-.061.037-.124.07V17.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 17.5v-1.573l-.124-.07A8 8 0 1 1 20 9" />
  </Svg>
);
export default SvgLightBulb;
