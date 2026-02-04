import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiImages = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm16 0H5v8.586L6.586 12a2 2 0 0 1 2.828 0l7 7H19zm-5.414 14L8 13.414l-3 3V19z"
      clipRule="evenodd"
    />
    <Path d="m13.575 8.35.478-.956a.5.5 0 0 1 .894 0l.479.957a.5.5 0 0 0 .223.224l.957.478a.5.5 0 0 1 0 .894l-.957.479a.5.5 0 0 0-.223.223l-.479.957a.5.5 0 0 1-.894 0l-.479-.957a.5.5 0 0 0-.223-.223l-.957-.479a.5.5 0 0 1 0-.894l.957-.478a.5.5 0 0 0 .223-.224Z" />
  </Svg>
);
export default SvgAiImages;
