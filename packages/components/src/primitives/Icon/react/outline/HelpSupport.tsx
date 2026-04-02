import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHelpSupport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.25 2c4.242 0 7.833 3.04 8.215 7.044A2.5 2.5 0 0 1 22.5 11.5V15c0 1.147-.773 2.11-1.826 2.405A5.5 5.5 0 0 1 15.25 22H11v-4h2v2h2.25a3.5 3.5 0 0 0 3.355-2.5H17.5V9h.945c-.397-2.772-2.962-5-6.195-5S6.452 6.228 6.055 9H7v8.5H4.5A2.5 2.5 0 0 1 2 15v-3.5a2.5 2.5 0 0 1 2.034-2.456C4.416 5.041 8.008 2 12.25 2M4.5 11a.5.5 0 0 0-.5.5V15a.5.5 0 0 0 .5.5H5V11zm15 4.5h.5a.5.5 0 0 0 .5-.5v-3.5a.5.5 0 0 0-.5-.5h-.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHelpSupport;
