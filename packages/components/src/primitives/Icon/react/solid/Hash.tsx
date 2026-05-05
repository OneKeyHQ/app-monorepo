import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHash = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M18.116 3.132 17.633 7H21v2h-3.617l-.75 6H21v2h-4.617l-.515 4.116-1.984-.248.483-3.868H8.383l-.515 4.116-1.984-.248L6.367 17H3v-2h3.617l.75-6H3V7h4.617l.515-4.116 1.984.248L9.633 7h5.984l.515-4.116zM8.633 15h5.984l.75-6H9.383z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHash;
