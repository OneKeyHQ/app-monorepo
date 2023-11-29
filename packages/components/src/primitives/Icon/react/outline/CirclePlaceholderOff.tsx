import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCirclePlaceholderOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.126 3.469A9 9 0 0 1 20.53 14.874M3.75 3.75l16.5 16.5M12 21A9 9 0 0 1 5.636 5.636l12.728 12.728A8.972 8.972 0 0 1 12 21Z"
    />
  </Svg>
);
export default SvgCirclePlaceholderOff;
