import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M11.615 2a3 3 0 0 1 2.965 3.462L14.185 8h3.879a4 4 0 0 1 3.962 4.54l-.681 5A4 4 0 0 1 17.38 21H2V10h4.382l4-8zM4 19h2v-7H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThumbDown;
