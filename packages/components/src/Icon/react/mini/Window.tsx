import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWindow = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3.25 3A2.25 2.25 0 0 0 1 5.25v9.5A2.25 2.25 0 0 0 3.25 17h13.5A2.25 2.25 0 0 0 19 14.75v-9.5A2.25 2.25 0 0 0 16.75 3H3.25zM2.5 9v5.75c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75V9h-15zM4 5.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75H4zM6.25 6A.75.75 0 0 1 7 5.25h.01a.75.75 0 0 1 .75.75v.01a.75.75 0 0 1-.75.75H7a.75.75 0 0 1-.75-.75V6zM10 5.25a.75.75 0 0 0-.75.75v.01c0 .414.336.75.75.75h.01a.75.75 0 0 0 .75-.75V6a.75.75 0 0 0-.75-.75H10z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgWindow;
