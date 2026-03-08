import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgChatGroup = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.002 15h-4v4h-7.241l-5.759 3.2V19h-3V7h4V3h16zm-18 2h3v1.8l3.241-1.8h5.759v-2H16v-2h.002V9h-12zm4-10h10v6h2V5h-12z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgChatGroup;
