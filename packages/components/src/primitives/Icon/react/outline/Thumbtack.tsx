import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbtack = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M17.5 6.997c0 1.658.659 3.247 1.831 4.419l.376.377.293.293V16h-7v6h-2v-6H4v-3.914l.67-.67A6.25 6.25 0 0 0 6.5 6.997V2h11zm-9 0a8.25 8.25 0 0 1-2.416 5.834L6 12.914V14h12v-1.086l-.084-.083A8.25 8.25 0 0 1 15.5 6.997V4h-7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThumbtack;
