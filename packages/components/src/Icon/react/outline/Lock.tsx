import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgLock = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M14.932 11.313H9.068c-.59 0-1.068.478-1.068 1.068v3.306c0 .59.478 1.068 1.068 1.068h5.864c.59 0 1.068-.478 1.068-1.068v-3.306c0-.59-.478-1.068-1.068-1.068ZM10 11.047V8.449a2.006 2.006 0 0 1 2-2 2.006 2.006 0 0 1 2 2v2.598"
      stroke="#8C8CA1"
      strokeWidth={2}
      strokeMiterlimit={10}
      strokeLinecap="square"
    />
    <Path
      d="M21 13.5a9 9 0 0 1-18 0V4.357c0-.5.348-.934.836-1.043l7.932-1.763c.153-.033.311-.033.464 0l7.932 1.763c.488.109.836.542.836 1.043V13.5Z"
      stroke="#8C8CA1"
      strokeWidth={2}
      strokeMiterlimit={10}
      strokeLinecap="square"
    />
  </Svg>
);

export default SvgLock;
