import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgForward = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12.14 11.248 6.658 6.452C6.013 5.886 5 6.345 5 7.204v9.593c0 .859 1.012 1.318 1.659.752l5.48-4.796a1 1 0 0 0 0-1.505Zm8 0-5.482-4.796C14.012 5.886 13 6.345 13 7.204v9.593c0 .859 1.012 1.318 1.659.752l5.48-4.796a1 1 0 0 0 0-1.505Z"
    />
  </Svg>
);
export default SvgForward;
