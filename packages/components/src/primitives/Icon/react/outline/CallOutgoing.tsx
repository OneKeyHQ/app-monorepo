import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCallOutgoing = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 4h4m0 0v4m0-4-5 5m3.004 10.877c-7.24-.901-12.98-6.64-13.88-13.881C3.986 4.9 4.894 4 6 4h1.312a2 2 0 0 1 1.916 1.425l.459 1.53a1.826 1.826 0 0 1-.458 1.816c-.55.55-.702 1.397-.292 2.06a13.067 13.067 0 0 0 4.232 4.232c.663.41 1.51.259 2.06-.292a1.825 1.825 0 0 1 1.815-.458l1.53.46A2 2 0 0 1 20 16.687V18c0 1.105-.9 2.013-1.996 1.877Z"
    />
  </Svg>
);
export default SvgCallOutgoing;
