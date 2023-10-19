import Svg, {
  SvgProps,
  G,
  Circle,
  Path,
  Defs,
  ClipPath,
} from 'react-native-svg';
const SvgPen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <Circle cx={10} cy={14.143} r={2} fill="currentColor" />
      <Path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="m18.086 11.713-3.291 6.946a2 2 0 0 1-1.545 1.126L3 21.142m15.086-9.428-5.657-5.657m5.657 5.656.164.165c.69.69 1.81.69 2.5 0v0c.69-.69.69-1.81 0-2.5l-5.985-5.986c-.69-.69-1.81-.69-2.5 0v0c-.69.69-.69 1.81 0 2.5l.164.165M3 21.142l1.29-10.296a2 2 0 0 1 1.148-1.568l6.991-3.221M3 21.142l7-7"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" d="M0 0h24v24H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgPen;
