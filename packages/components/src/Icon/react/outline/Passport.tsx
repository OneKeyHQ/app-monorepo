import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPassport = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.5 16h5m0-5.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-8 10h11a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-11a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgPassport;
