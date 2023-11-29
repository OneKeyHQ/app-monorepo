import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBallRugby = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m10.25 13.75 3.5-3.5m-.607-7.107A12.092 12.092 0 0 1 15 3h5a1 1 0 0 1 1 1v5c0 .632-.049 1.252-.143 1.857m-7.714-7.714 7.714 7.714m-7.714-7.714a12.009 12.009 0 0 0-10 10m17.714-2.286a12.01 12.01 0 0 1-10 10m0 0C10.252 20.951 9.632 21 9 21H4a1 1 0 0 1-1-1v-5c0-.632.049-1.252.143-1.857m7.714 7.714-7.714-7.714"
    />
  </Svg>
);
export default SvgBallRugby;
