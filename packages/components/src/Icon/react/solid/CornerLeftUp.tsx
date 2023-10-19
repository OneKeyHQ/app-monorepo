import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCornerLeftUp = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12.707 6.793a1 1 0 0 1-1.414 1.414L9 5.914V16a3 3 0 0 0 3 3h8a1 1 0 1 1 0 2h-8a5 5 0 0 1-5-5V5.914L4.707 8.207a1 1 0 0 1-1.414-1.414L6.586 3.5a2 2 0 0 1 2.828 0l3.293 3.293Z"
    />
  </Svg>
);
export default SvgCornerLeftUp;
