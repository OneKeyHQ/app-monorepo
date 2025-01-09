import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgHd = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M15.398 13.854h-.649V10.1h.65c.99 0 1.577.64 1.577 1.826 0 1.299-.542 1.928-1.578 1.928Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7Zm3.081 7.538c0 .693.376 1.084 1.035 1.084.66 0 1.035-.39 1.035-1.084v-1.763h2.48v1.763c0 .693.377 1.084 1.036 1.084.66 0 1.035-.39 1.035-1.084V9.416c0-.693-.376-1.084-1.035-1.084-.66 0-1.035.39-1.035 1.084v1.714h-2.48V9.416c0-.693-.377-1.084-1.036-1.084s-1.035.39-1.035 1.084v5.122Zm7.598-.122c0 .693.376 1.084 1.035 1.084h1.977c2.134 0 3.394-1.318 3.394-3.574s-1.255-3.472-3.394-3.472h-1.977c-.66 0-1.035.39-1.035 1.084v4.878Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgHd;
