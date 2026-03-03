import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWallet4 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16.5 12a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
    <Path
      fillRule="evenodd"
      d="M20 4v3h2v13H5a3 3 0 0 1-3-3V6.5A2.5 2.5 0 0 1 4.499 4zM4 17a1 1 0 0 0 1 1h15V9H4.5a2.5 2.5 0 0 1-.5-.05zM4 6.5a.5.5 0 0 0 .5.5H18V6H4.499A.5.5 0 0 0 4 6.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWallet4;
