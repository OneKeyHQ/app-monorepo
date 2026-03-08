import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDisk1 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M21 6.586V21H3V3h14.414zM5 19h2v-7h10v7h2V7.414l-2-2V9H7V5H5zm4 0h6v-5H9zM9 7h6V5H9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDisk1;
