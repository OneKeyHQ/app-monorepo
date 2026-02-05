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
      d="M12 2c4.242 0 7.833 3.04 8.215 7.044A2.5 2.5 0 0 1 22.25 11.5V15c0 1.147-.773 2.11-1.826 2.405A5.5 5.5 0 0 1 15 22h-1.75a2.5 2.5 0 0 1-2.5-2.5V19a1 1 0 1 1 2 0v.5a.5.5 0 0 0 .5.5H15a3.5 3.5 0 0 0 3.355-2.5h-.105a1 1 0 0 1-1-1V10a1 1 0 0 1 .944-.998C17.798 6.229 15.234 4 12 4S6.2 6.229 5.805 9.002A1 1 0 0 1 6.75 10v6.5a1 1 0 0 1-1 1h-1.5a2.5 2.5 0 0 1-2.5-2.5v-3.5a2.5 2.5 0 0 1 2.034-2.456C4.166 5.041 7.758 2 12 2m-7.75 9a.5.5 0 0 0-.5.5V15a.5.5 0 0 0 .5.5h.5V11zm15 4.5h.5a.5.5 0 0 0 .5-.5v-3.5a.5.5 0 0 0-.5-.5h-.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHelpSupport;
