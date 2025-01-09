import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHomeSimple = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.892 1.999a3 3 0 0 0-3.784 0l-6 4.875A3 3 0 0 0 3 9.202V18a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V9.202a3 3 0 0 0-1.108-2.328l-6-4.875Z"
    />
  </Svg>
);
export default SvgHomeSimple;
