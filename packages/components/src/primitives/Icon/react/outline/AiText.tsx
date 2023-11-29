import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAiText = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 18h3m-3-6h5M4 6h16m-3 4 1.5 3.5L22 15l-3.5 1.5L17 20l-1.5-3.5L12 15l3.5-1.5L17 10Z"
    />
  </Svg>
);
export default SvgAiText;
