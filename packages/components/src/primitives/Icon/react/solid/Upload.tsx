import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgUpload = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M4 11.75a1 1 0 0 1 1 1V19h14v-6.25a1 1 0 1 1 2 0V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6.25a1 1 0 0 1 1-1"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M12 3a1 1 0 0 1 .707.293l4.5 4.5a1 1 0 0 1-1.414 1.414L13 6.414v8.836a1 1 0 1 1-2 0V6.414L8.207 9.207a1 1 0 0 1-1.414-1.414l4.5-4.5A1 1 0 0 1 12 3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUpload;
