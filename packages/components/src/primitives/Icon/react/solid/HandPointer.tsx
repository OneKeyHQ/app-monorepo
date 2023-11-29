import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHandPointer = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11.931 8.667h5.512c1.826 0 3.307 1.492 3.307 3.333v2.033c0 4.4-3.539 7.967-7.905 7.967a7.896 7.896 0 0 1-6.994-4.257l-2.987-5.72a1.006 1.006 0 0 1 .103-1.09l.422-.531a2.193 2.193 0 0 1 3.099-.347l1.034.834V4.222C7.522 2.995 8.51 2 9.727 2s2.204.995 2.204 2.222v4.445Z"
    />
  </Svg>
);
export default SvgHandPointer;
