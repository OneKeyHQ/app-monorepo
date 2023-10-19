import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAiImages = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm3-1a1 1 0 0 0-1 1v7.586l.879-.879a3 3 0 0 1 4.242 0L16.414 19H18a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H6Zm7.586 14-4.879-4.879a1 1 0 0 0-1.414 0L5 16.414V18a1 1 0 0 0 1 1h7.586Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m13.575 8.35.478-.956a.5.5 0 0 1 .894 0l.479.957a.5.5 0 0 0 .223.224l.957.478a.5.5 0 0 1 0 .894l-.957.479a.499.499 0 0 0-.223.223l-.479.957a.5.5 0 0 1-.894 0l-.479-.957a.499.499 0 0 0-.223-.223l-.957-.479a.5.5 0 0 1 0-.894l.957-.478a.5.5 0 0 0 .223-.224Z"
    />
  </Svg>
);
export default SvgAiImages;
