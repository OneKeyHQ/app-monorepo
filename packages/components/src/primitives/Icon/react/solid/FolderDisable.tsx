import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFolderDisable = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2.465 12.465a5 5 0 1 1 7.07 7.07 5 5 0 0 1-7.07-7.07m.827 2.241a3.002 3.002 0 0 0 4.002 4.002zm4.83-.827a3 3 0 0 0-3.416-.587l4.002 4.002a3 3 0 0 0-.587-3.415Z"
      clipRule="evenodd"
    />
    <Path d="M12.534 6H22v14H11.745A7.002 7.002 0 0 0 2 10.254V3h8.535z" />
  </Svg>
);
export default SvgFolderDisable;
