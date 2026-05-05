import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgGiftcard = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h9v-3.586l-1.5 1.5-1.414-1.414 1.5-1.5H4zm13.914-3.5L16.5 15.914l-1.5-1.5V18h5v-5h-3.586zM4 11h7.586l-1.5-1.5L11.5 8.086l1.5 1.5V6H4zm11-1.414 1.5-1.5L17.914 9.5l-1.5 1.5H20V6h-5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgGiftcard;
