import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKnob = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 3v18H3V3zm-9 4a5 5 0 1 0 2.757 9.172L11.586 13 13 11.586l3.172 3.17A5 5 0 0 0 12 7"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKnob;
