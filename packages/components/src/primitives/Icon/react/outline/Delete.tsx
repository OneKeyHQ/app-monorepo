import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDelete = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 17H9v-7h2zm4 0h-2v-7h2z" />
    <Path
      fillRule="evenodd"
      d="M12 1.5A5 5 0 0 1 16.77 5h4.73v2h-1.532l-1.034 15H5.066L4.032 7H2.5V5h4.73A5 5 0 0 1 12 1.5M6.934 20h10.132l.897-13H6.037zM12 3.5c-1.11 0-2.078.604-2.597 1.5h5.194A3 3 0 0 0 12 3.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDelete;
