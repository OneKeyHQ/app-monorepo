import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEye = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 4c4.239 0 8.338 2.611 10.888 7.54l.238.46-.238.459C20.338 17.389 16.239 20 12 20c-4.24 0-8.34-2.61-10.889-7.54L.874 12l.237-.459C3.661 6.611 7.761 4 12 4m0 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEye;
