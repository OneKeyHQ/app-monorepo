import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageLike = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21.002 19.036h-5.626l-3.382 2.802-3.343-2.802H3.002V3h18zM10.349 9.6l-2.6 1v.8l2.6 1 1 2.6h.8l1-2.6 2.6-1v-.8l-2.6-1-1-2.6h-.8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageLike;
