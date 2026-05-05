import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgConnection = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      d="M100 80h17v10h-17z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      d="M93 87h17v10H93zM97 57h17v10H97z"
    />
    <Path
      fill="#000"
      stroke="#000"
      strokeLinejoin="round"
      d="M81 39a1 1 0 0 1 1 1v56a1 1 0 0 1-1 1h-9c-3.035 0-6 2.177-6 5.212V112a1 1 0 0 1-1 1h-1c-16.568 0-30-13.431-30-30v-7c0-3.496.855-6.793 2.366-9.693C41.8 55.882 52.714 45.606 63.45 40.814A20.9 20.9 0 0 1 72 39z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      d="M71.001 39h10.995l-16 16H55zM34 76c0-11.598 9.402-21 21-21h11v58H55c-11.598 0-21-9.402-21-21zM82 39v58l-16 16V55z"
    />
    <Path
      fill="#4FE737"
      d="M134 39c11.598 0 21 9.402 21 21v16c0 3.42-.818 6.649-2.268 9.502-5.132 10.095-15.135 20.098-25.23 25.23A20.9 20.9 0 0 1 118 113h-10a1 1 0 0 1-1-1V56a1 1 0 0 1 1-1h10c2.57 0 5-1.878 5-4.447V40a1 1 0 0 1 1-1z"
    />
    <Path
      fill="#000"
      d="M108 113v.5zm0-58v-.5zm16-16v-.5zm10 0v.5c11.322 0 20.5 9.178 20.5 20.5h1c0-11.874-9.626-21.5-21.5-21.5zm21 21h-.5v16h1V60zm0 16h-.5a20.4 20.4 0 0 1-2.214 9.275l.446.227.446.226A21.4 21.4 0 0 0 155.5 76zm-27.498 34.732-.227-.446A20.4 20.4 0 0 1 118 112.5v1c3.501 0 6.807-.837 9.728-2.322zM118 113v-.5h-10v1h10zm-10 0v-.5a.5.5 0 0 1-.5-.5h-1a1.5 1.5 0 0 0 1.5 1.5zm-1-1h.5V56h-1v56zm0-56h.5a.5.5 0 0 1 .5-.5v-1a1.5 1.5 0 0 0-1.5 1.5zm1-1v.5h10v-1h-10zm15-4.447h.5V40h-1v10.553zM123 40h.5a.5.5 0 0 1 .5-.5v-1a1.5 1.5 0 0 0-1.5 1.5zm1-1v.5h10v-1h-10zm-6 16v.5c2.767 0 5.5-2.03 5.5-4.947h-1c0 2.22-2.128 3.947-4.5 3.947zm34.732 30.502-.446-.227c-5.084 10.001-15.01 19.927-25.011 25.011l.227.446.226.446c10.19-5.181 20.269-15.26 25.45-25.45z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      d="M134 39c11.598 0 21 9.402 21 21v16l-25 25-23-46 16.5-16z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      strokeLinejoin="round"
      d="M107 55h11c11.598 0 21 9.402 21 21v16c0 11.598-9.402 21-21 21h-11z"
    />
    <Path
      fill="#000"
      d="m73 59 3-3v10l-3 3zM69 90l3-3v10l-3 3zM76 83l3-3v10l-3 3z"
    />
    <Path stroke="#000" d="M147.438 76H166v64H17V76h16.556" />
    <Path
      stroke="#000"
      strokeDasharray="2 2"
      strokeLinejoin="round"
      d="M95 36.5V25M107.944 28.913l-8.132 8.131M90.132 37.044 82 28.913M89.938 115.544v11.5M77.001 123.132 85.133 115M94.806 115l8.132 8.132"
    />
  </Svg>
);
export default SvgConnection;
