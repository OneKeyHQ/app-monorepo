import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgVideoClip = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M4 12h4m-4 0V8m0 4v4m4-4h8m-8 0v4m0-4V8m8 4h4m-4 0v4.444M16 12V8m4 4V8m0 4v4.444M16 20h2a2 2 0 0 0 2-2v-1.556M16 20v-3.556M16 20H8m8-16h2a2 2 0 0 1 2 2v2m-4-4v4m0-4H8m8 4h4m-4 8.444h4M8 20H6a2 2 0 0 1-2-2v-2m4 4v-4M8 4H6a2 2 0 0 0-2 2v2m4-4v4M4 8h4m-4 8h4"
    />
  </Svg>
);
export default SvgVideoClip;
