import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDrop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.982 2.85a2.746 2.746 0 0 0-3.964 0C8.985 3.913 7.5 5.578 6.268 7.51 5.05 9.421 4 11.712 4 14a8 8 0 0 0 16 0c0-2.288-1.05-4.579-2.268-6.49-1.232-1.932-2.717-3.597-3.75-4.66Z"
    />
  </Svg>
);
export default SvgDrop;
