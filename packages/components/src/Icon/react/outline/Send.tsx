import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSend = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 12h3m-3 0L3.752 5.256c-.28-.84.59-1.603 1.386-1.216l14.514 7.06a1 1 0 0 1 0 1.8L5.138 19.96c-.796.387-1.666-.375-1.386-1.216L6 12Z"
    />
  </Svg>
);
export default SvgSend;
