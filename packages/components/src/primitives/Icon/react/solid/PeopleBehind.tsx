import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleBehind = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M14.608 17.613C13.594 13.981 10.87 12 8 12c-2.87 0-5.594 1.98-6.607 5.613C.863 19.513 2.483 21 4.146 21h7.708c1.663 0 3.284-1.487 2.754-3.387ZM4 7a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm9.5.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Zm.696 5.273c1.046 1.136 1.86 2.59 2.338 4.303A4.5 4.5 0 0 1 16.39 20h3.917c1.498 0 2.983-1.344 2.498-3.084C21.92 13.748 19.535 12 17.003 12c-.985 0-1.947.264-2.807.773Z"
    />
  </Svg>
);
export default SvgPeopleBehind;
