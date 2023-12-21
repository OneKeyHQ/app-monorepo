import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCallIncoming = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9h-4m0 0V5m0 4 5-5m-1.996 15.877c-7.24-.901-12.98-6.64-13.88-13.881C3.986 4.9 4.894 4 6 4h1.312a2 2 0 0 1 1.916 1.425l.6 2.003a1 1 0 0 1-.25.994l-.26.26c-.604.604-.77 1.533-.315 2.255a13.068 13.068 0 0 0 4.06 4.06c.722.456 1.65.29 2.254-.314l.26-.26a1 1 0 0 1 .995-.251l2.003.6A2 2 0 0 1 20 16.688V18c0 1.105-.9 2.013-1.996 1.877Z"
    />
  </Svg>
);
export default SvgCallIncoming;
