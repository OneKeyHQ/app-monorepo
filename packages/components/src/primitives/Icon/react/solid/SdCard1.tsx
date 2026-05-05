import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSdCard1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18 2v5.697l2 3V22H4V2zM8 6v4h2V6zm4 4h2V6h-2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSdCard1;
