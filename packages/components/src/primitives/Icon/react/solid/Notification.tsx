import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNotification = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 2C7.792 2 4.198 5.173 3.75 9.356l-.724 5.9A2 2 0 0 0 5.01 17.5h13.978a2 2 0 0 0 1.985-2.244l-.724-5.9C19.802 5.173 16.208 2 12 2m4.584 17H7.416a5.001 5.001 0 0 0 9.168 0" />
  </Svg>
);
export default SvgNotification;
