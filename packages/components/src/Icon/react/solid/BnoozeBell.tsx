import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBnoozeBell = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4.702 8.943a7.307 7.307 0 0 1 14.596 0l.18 3.588a1 1 0 0 0 .104.397l1.227 2.454A1.809 1.809 0 0 1 19.191 18H16.9a5.002 5.002 0 0 1-9.8 0H4.809a1.809 1.809 0 0 1-1.618-2.618l1.227-2.454a1 1 0 0 0 .104-.397l.18-3.588ZM9.17 18a3.001 3.001 0 0 0 5.658 0H9.171ZM10.5 7.5a1 1 0 0 0 0 2h1l-1.8 2.4a1 1 0 0 0 .8 1.6h3a1 1 0 1 0 0-2h-1l1.8-2.4a1 1 0 0 0-.8-1.6h-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBnoozeBell;
