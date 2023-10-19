import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEditList = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.002 4h16m-16 4h6.5M4 12h3.002m11.55-2.586 1.036 1.037a2 2 0 0 1 0 2.828L11.867 21H8.002v-3.865l7.72-7.72a2 2 0 0 1 2.83 0Z"
    />
  </Svg>
);
export default SvgEditList;
