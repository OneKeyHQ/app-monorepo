import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCake = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="m12 .757 2.122 2.122A3 3 0 0 1 13 7.829V9h4.5a3 3 0 0 1 3 3v1.646a2.99 2.99 0 0 1-.5 1.658V19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-3.696a2.996 2.996 0 0 1-.5-1.658V12a3 3 0 0 1 3-3H11V7.829a3 3 0 0 1-1.121-4.95L12 .757ZM6.5 11a1 1 0 0 0-1 1v1.646a1 1 0 0 0 .629.928l.5.2a1 1 0 0 0 .742 0l1.015-.405a3 3 0 0 1 2.228 0l1.015.405a1 1 0 0 0 .742 0l1.015-.405a3 3 0 0 1 2.228 0l1.015.405a1 1 0 0 0 .742 0l.5-.2a1 1 0 0 0 .629-.928V12a1 1 0 0 0-1-1h-11Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCake;
