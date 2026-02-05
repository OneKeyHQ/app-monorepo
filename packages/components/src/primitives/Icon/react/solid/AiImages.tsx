import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiImages = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.053 7.395a.5.5 0 0 1 .894 0l.479.956a.5.5 0 0 0 .223.223l.957.479a.5.5 0 0 1 0 .894l-.957.479a.5.5 0 0 0-.223.223l-.479.957a.5.5 0 0 1-.894 0l-.479-.957a.5.5 0 0 0-.223-.223l-.957-.479a.5.5 0 0 1 0-.894l.957-.479a.5.5 0 0 0 .223-.223z" />
    <Path
      fillRule="evenodd"
      d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM5 13.586 6.586 12a2 2 0 0 1 2.828 0l7 7H19V5H5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAiImages;
