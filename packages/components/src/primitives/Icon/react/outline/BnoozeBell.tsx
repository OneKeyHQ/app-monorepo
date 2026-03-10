import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBnoozeBell = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14.5 9.414 12.414 11.5H14.5v2h-5v-1.914L11.586 9.5H9.5v-2h5z" />
    <Path
      fillRule="evenodd"
      d="M12 2a7.31 7.31 0 0 1 7.299 6.942l.19 3.798L21 15.764V18h-4.102a5 5 0 0 1-9.796 0H3v-2.236l1.51-3.024.191-3.798A7.31 7.31 0 0 1 12 2M9.174 18A3 3 0 0 0 12 20a3 3 0 0 0 2.827-2zM12 4a5.307 5.307 0 0 0-5.3 5.042l-.201 4.008-.01.21L5.118 16h13.763l-1.37-2.74-.011-.21-.2-4.008A5.307 5.307 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBnoozeBell;
