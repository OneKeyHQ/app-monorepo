import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBrush = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M20.793 8.379a3 3 0 0 1 0 4.242l-5.586 5.586a2.414 2.414 0 0 1-3.414 0 1.12 1.12 0 0 0-1.585-.001l-2.586 2.587a3 3 0 0 1-4.242 0l-.172-.171a3 3 0 0 1 0-4.244l2.586-2.586a1.12 1.12 0 0 0 0-1.585 2.413 2.413 0 0 1-.001-3.414L7.776 6.81a.98.98 0 0 1 .017-.017l3.586-3.586a3 3 0 0 1 4.242 0l2.586 2.586a1 1 0 0 1 .293.707v1h1a1 1 0 0 1 .707.293M15.086 15.5 8.5 8.914l-1.293 1.293a.413.413 0 0 0 0 .585 3.12 3.12 0 0 1 .002 4.414l-2.587 2.587a1 1 0 0 0 0 1.414l.172.172a1 1 0 0 0 1.414 0l2.586-2.587a3.12 3.12 0 0 1 4.414 0 .413.413 0 0 0 .585 0l1.293-1.292Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrush;
