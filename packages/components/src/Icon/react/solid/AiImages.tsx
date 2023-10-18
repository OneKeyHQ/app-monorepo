import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAiImages = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-2.61 2.975l.024.025H6a3 3 0 0 1-3-3V6Zm13.414 13-6.293-6.293a3 3 0 0 0-4.242 0L5 13.586V6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-1.586Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="m13.575 8.35.478-.956a.5.5 0 0 1 .894 0l.479.957a.5.5 0 0 0 .223.224l.957.478a.5.5 0 0 1 0 .894l-.957.479a.499.499 0 0 0-.223.223l-.479.957a.5.5 0 0 1-.894 0l-.479-.957a.499.499 0 0 0-.223-.223l-.957-.479a.5.5 0 0 1 0-.894l.957-.478a.5.5 0 0 0 .223-.224Z"
    />
  </Svg>
);
export default SvgAiImages;
