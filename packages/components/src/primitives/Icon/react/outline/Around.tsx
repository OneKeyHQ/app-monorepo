import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAround = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 6c0-1.105-4.03-2-9-2s-9 .895-9 2m18 0c0 .616-1.255 1.168-3.227 1.534C16.77 7.721 16 8.564 16 9.584v6.624M21 6v12c0 .57-1.073 1.084-2.794 1.448-1.165.247-2.206-.697-2.206-1.889v-1.351M3 6c0 .616 1.255 1.168 3.227 1.534C7.23 7.721 8 8.564 8 9.584v6.624M3 6v12c0 .57 1.073 1.084 2.794 1.448C6.96 19.695 8 18.751 8 17.56v-1.351m0 0A36.855 36.855 0 0 1 12 16c1.437 0 2.795.075 4 .208"
    />
  </Svg>
);
export default SvgAround;
