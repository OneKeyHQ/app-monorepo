import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFocusFlower = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 20.143A5.143 5.143 0 0 1 17.21 15a.796.796 0 0 1 .79.79v.067a5.143 5.143 0 0 1-5.939 5.082 5.182 5.182 0 0 1-.061-.796Zm0 0A5.143 5.143 0 0 0 6.79 15a.796.796 0 0 0-.79.79v.067a5.143 5.143 0 0 0 5.939 5.082c.04-.26.061-.525.061-.796ZM12 14v7m1.905-16.726-.968-.774a1.5 1.5 0 0 0-1.874 0l-.968.774a1.307 1.307 0 0 1-1.302.193l-1.038-.415a.55.55 0 0 0-.755.51V8a5 5 0 0 0 10 0V4.563a.55.55 0 0 0-.755-.511l-1.038.415a1.307 1.307 0 0 1-1.302-.193Z"
    />
  </Svg>
);
export default SvgFocusFlower;
