import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNotificationBadge = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5m.121-9.121A3 3 0 1 1 15.88 8.12a3 3 0 0 1 4.24-4.24Z"
    />
  </Svg>
);
export default SvgNotificationBadge;
