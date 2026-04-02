import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCarussel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 5h4v14h-4v2H6v-2H2V5h4V3h12zM8 19h8V5H8zM4 7v10h2V7zm14 10h2V7h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCarussel;
