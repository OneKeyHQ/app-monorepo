import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';
const SvgJuno = (props: SvgProps) => (
  <Svg viewBox="0 0 16 16" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)" clipRule="evenodd">
      <Path
        d="M12.789 7.99a4.798 4.798 0 1 1-9.597 0 4.798 4.798 0 0 1 9.597 0Z"
        stroke="#8C8CA1"
        strokeWidth={0.385}
      />
      <Path
        fillRule="evenodd"
        d="m9.976 6.792-1.269-.053.862-.933-.347-.347-.934.86-.05-1.27h-.491l-.053 1.27-.933-.862-.347.347.86.934-1.27.05v.491l1.27.053-.862.933.347.347.92-.847.04 2.056-.734.054v.456l.745.057.014.714h.49l.015-.713.753-.057v-.457l-.742-.054.042-2.055.918.848.347-.347-.86-.934 1.27-.05v-.491Z"
        fill="#8C8CA1"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" transform="translate(3 3)" d="M0 0h10v10H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgJuno;
