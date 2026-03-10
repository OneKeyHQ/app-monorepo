import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPencil = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22.414 7.5 7.914 22H2v-5.914l14.5-14.5zM4 16.914V20h3.086l9.5-9.5L13.5 7.414zM14.914 6 18 9.086 19.586 7.5 16.5 4.414z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPencil;
