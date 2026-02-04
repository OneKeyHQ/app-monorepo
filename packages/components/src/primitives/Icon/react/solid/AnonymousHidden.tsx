import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAnonymousHidden = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.867 3a2 2 0 0 0-1.98 1.717L4.133 10H3a1 1 0 1 0 0 2h18a1 1 0 1 0 0-2h-1.133l-.754-5.283A2 2 0 0 0 17.133 3z" />
    <Path
      fillRule="evenodd"
      d="M7 13a4 4 0 1 0 3.99 4.273 2 2 0 0 1 2.02 0 4 4 0 1 0 .391-2.02 4 4 0 0 0-2.802 0A4 4 0 0 0 7 13m-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0m10.006-.154a2 2 0 1 1 3.988.308 2 2 0 0 1-3.988-.308"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAnonymousHidden;
