import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBank = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 6.382V10h-2v6h.722l1.666 5H1.613l1.667-5H4v-6H2V6.382l10-5zM6 16h2v-6H6zm4 0h4v-6h-4zm6 0h2v-6h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBank;
