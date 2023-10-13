import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBell = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 17a4 4 0 0 1-8 0m10.3-8.007.179 3.588c.014.276.085.547.209.794l1.227 2.454A.808.808 0 0 1 19.19 17H4.809a.809.809 0 0 1-.724-1.17l1.227-2.455a2 2 0 0 0 .209-.794l.18-3.588a6.308 6.308 0 0 1 12.599 0Z"
    />
  </Svg>
);
export default SvgBell;
