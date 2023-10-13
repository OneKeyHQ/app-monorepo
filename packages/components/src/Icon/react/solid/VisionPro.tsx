import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';
const SvgVisionPro = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <Path
        fill="currentColor"
        d="M12 5c-2.494 0-5.415.118-7.732 1.003-1.176.45-2.256 1.119-3.04 2.124C.432 9.144 0 10.43 0 12c0 1.648.41 3.37 1.377 4.71C2.372 18.09 3.92 19 6 19c1.029 0 1.847-.223 2.53-.585.67-.354 1.162-.817 1.552-1.208l.14-.14C10.955 16.332 11.285 16 12 16c.715 0 1.045.332 1.778 1.067l.14.14c.39.39.883.854 1.552 1.208.683.362 1.501.585 2.53.585 2.087 0 3.634-.934 4.625-2.316C23.59 15.339 24 13.619 24 12c0-1.569-.433-2.856-1.227-3.873-.785-1.005-1.865-1.674-3.04-2.124C17.414 5.118 14.493 5 12 5Z"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" d="M0 0h24v24H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgVisionPro;
