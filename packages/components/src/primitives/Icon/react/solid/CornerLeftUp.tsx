import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCornerLeftUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.038 19.995c0-.555-.45-1.004-1.005-1.004H9.99V6.345l2.304 2.304a1.005 1.005 0 1 0 1.421-1.421l-4.019-4.02a1.005 1.005 0 0 0-1.42 0l-4.02 4.02a1.005 1.005 0 0 0 1.421 1.42l2.304-2.303V18.99c0 1.11.9 2.01 2.01 2.01h9.042c.555 0 1.005-.45 1.005-1.006Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCornerLeftUp;
