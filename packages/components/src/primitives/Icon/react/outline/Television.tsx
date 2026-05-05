import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTelevision = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 18c2.21 0 4.336.37 6.325 1.055l.945.325-.65 1.89-.945-.325A17.4 17.4 0 0 0 12 20c-1.984 0-3.892.332-5.675.945l-.945.325-.65-1.89.945-.325A19.4 19.4 0 0 1 12 18" />
    <Path
      fillRule="evenodd"
      d="M22 17H2V3h20zM4 15h16V5H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTelevision;
