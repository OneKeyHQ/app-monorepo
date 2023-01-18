import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';
const SvgLoadingIndicator = (props: SvgProps) => (
  <Svg viewBox="0 0 25 24" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <Path
        d="M12.5 22c5.523 0 10-4.477 10-10s-4.477-10-10-10-10 4.477-10 10 4.477 10 10 10Z"
        stroke="#A0A0B0"
        strokeWidth={4}
      />
      <Path
        d="M6.843 6.343A8 8 0 0 0 6.5 17.291l-3 2.647A11.966 11.966 0 0 1 .5 12c0-6.627 5.373-12 12-12v4a8 8 0 0 0-5.657 2.343Z"
        fill="#D3D3DE"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" transform="translate(.5)" d="M0 0h24v24H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgLoadingIndicator;
