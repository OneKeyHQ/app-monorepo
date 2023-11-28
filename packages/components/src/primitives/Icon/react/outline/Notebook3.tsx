import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNotebook3 = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3.5 12h2m4.5 0h2m-2-4h4M3.5 8h2m-2 8h2m1 4.5h11a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-11a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgNotebook3;
