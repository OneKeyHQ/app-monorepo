import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFilterDescending = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="m8 17.336 2-2 1.414 1.414L7 21.164 2.586 16.75 4 15.336l2 2V3h2z" />
    <Path
      fillRule="evenodd"
      d="M21 18.3V21h-2v-1.5h-3V21h-2v-2.7l2.209-5.3h2.583zm-4.5-.8h2l-1-2.4z"
      clipRule="evenodd"
    />
    <Path d="M21 4.914 16.914 9H21v2h-7V9.086L18.086 5H14V3h7z" />
  </Svg>
);
export default SvgFilterDescending;
