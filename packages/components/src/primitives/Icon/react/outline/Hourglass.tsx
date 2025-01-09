import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHourglass = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 12 6.89 8.594A2 2 0 0 1 6 6.93V3h12v3.93a2 2 0 0 1-.89 1.664L12 12Zm0 0 5.11 3.406A2 2 0 0 1 18 17.07V21H6v-3.93a2 2 0 0 1 .89-1.664L12 12Zm8 9H4M20 3H4"
    />
  </Svg>
);
export default SvgHourglass;
