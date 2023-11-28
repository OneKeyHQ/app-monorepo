import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRuler = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.878 2.707a3 3 0 0 1 4.243 0l3.172 3.172a3 3 0 0 1 0 4.242L10.12 21.293a3 3 0 0 1-4.243 0l-3.17-3.173a3 3 0 0 1 0-4.242l1.379-1.38 1.957 1.958a1 1 0 0 0 1.414-1.414L5.5 11.086 7.586 9l2.957 2.957a1 1 0 0 0 1.414-1.414L9 7.586 11.086 5.5l1.957 1.957a1 1 0 1 0 1.414-1.414L12.5 4.086l1.378-1.379Z"
    />
  </Svg>
);
export default SvgRuler;
