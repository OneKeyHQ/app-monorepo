import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBnoozeBell = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2a7.31 7.31 0 0 1 7.299 6.942l.19 3.798L21 15.764V18h-4.1a5.002 5.002 0 0 1-9.8 0H3v-2.236l1.512-3.024.19-3.798A7.31 7.31 0 0 1 12 2M9.17 18a3.001 3.001 0 0 0 5.66 0zm.33-8.5h2.086L9.5 11.586V13.5h5v-2h-2.086L14.5 9.414V7.5h-5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBnoozeBell;
