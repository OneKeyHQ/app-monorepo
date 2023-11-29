import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBunnyHat = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 12h2m-2 0v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7m14 0H5m-2 0h2m1.745 0a22.465 22.465 0 0 1-.512-2.56c-.55-3.858-.093-7.183 1.022-7.426 1.114-.243 2.462 2.688 3.012 6.546.175 1.228.248 2.402.23 3.44m6.003 0c1-1.5 1.284-2.879 1.5-4l1.999.25c3.5.5-2.499-6-4.5-4-1.995 1.994-1.997 4.236-1.999 7.718V12"
    />
  </Svg>
);
export default SvgBunnyHat;
