import Svg, { Path } from 'react-native-svg';
import type { IconProps } from './HouseIcon';

export default function DumbbellIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 8v8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M4 9.5v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M17 8v8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M20 9.5v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M7 12h10" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
