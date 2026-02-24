import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHeart = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 3c1.518 0 3.035.609 4.167 1.816C21.304 6.03 22 7.786 22 10c0 3.345-2.373 6.102-4.582 7.927a21.7 21.7 0 0 1-3.21 2.193 14 14 0 0 1-1.212.606 5 5 0 0 1-.467.177A1.8 1.8 0 0 1 12 21c-.216 0-.421-.062-.53-.097a5 5 0 0 1-.466-.177c-.335-.144-.75-.35-1.212-.606a21.7 21.7 0 0 1-3.21-2.193C4.373 16.102 2 13.345 2 10c0-2.214.696-3.971 1.833-5.184A5.7 5.7 0 0 1 8 3a7.1 7.1 0 0 1 4 1.229A7.1 7.1 0 0 1 16 3" />
  </Svg>
);
export default SvgHeart;
