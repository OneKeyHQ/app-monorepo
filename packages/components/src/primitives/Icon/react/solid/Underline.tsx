import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUnderline = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 4a1 1 0 0 0-2 0v8a7 7 0 1 0 14 0V4a1 1 0 1 0-2 0v8a5 5 0 0 1-10 0V4ZM6 20a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H6Z"
    />
  </Svg>
);
export default SvgUnderline;
