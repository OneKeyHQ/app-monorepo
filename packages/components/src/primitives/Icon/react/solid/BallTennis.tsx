import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBallTennis = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 12c0-2.536.944-4.852 2.5-6.615A7.992 7.992 0 0 1 8 12a7.992 7.992 0 0 1-3.5 6.615A9.962 9.962 0 0 1 2 12Z"
    />
    <Path
      fill="currentColor"
      d="M10 12a9.985 9.985 0 0 0-4-8 9.956 9.956 0 0 1 6-2c2.251 0 4.329.744 6 2a9.985 9.985 0 0 0-4 8 9.985 9.985 0 0 0 4 8 9.956 9.956 0 0 1-6 2 9.956 9.956 0 0 1-6-2 9.985 9.985 0 0 0 4-8Z"
    />
    <Path
      fill="currentColor"
      d="M19.5 5.385A9.962 9.962 0 0 1 22 12a9.962 9.962 0 0 1-2.5 6.615A7.991 7.991 0 0 1 16 12a7.992 7.992 0 0 1 3.5-6.615Z"
    />
  </Svg>
);
export default SvgBallTennis;
