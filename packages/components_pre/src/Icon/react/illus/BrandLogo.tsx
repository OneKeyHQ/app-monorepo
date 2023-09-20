import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';
const SvgBrandLogo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 27 27" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <Path
        d="M26.918 13.459c0 9.291-4.168 13.459-13.46 13.459C4.169 26.918 0 22.75 0 13.458 0 4.169 4.167 0 13.459 0c9.291 0 13.459 4.167 13.459 13.459Z"
        fill="#44D62C"
      />
      <Path
        d="M14.675 5.707H10.93l-.657 1.986h2.08v4.184h2.32v-6.17Z"
        fill="#000"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.729 16.94a4.27 4.27 0 1 1-8.54 0 4.27 4.27 0 0 1 8.54 0Zm-1.939 0a2.332 2.332 0 1 1-4.663 0 2.332 2.332 0 0 1 4.663 0Z"
        fill="#000"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path fill="#fff" d="M0 0h27v27H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgBrandLogo;
