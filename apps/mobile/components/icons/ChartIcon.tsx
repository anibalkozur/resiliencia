import Svg, { Rect } from 'react-native-svg';
import type { ColorValue } from 'react-native';

export type IconProps = {
  color: ColorValue;
  size: number;
};

export default function ChartIcon({ color, size }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={14} width={4} height={7} rx={1} fill={color} />
      <Rect x={10} y={8} width={4} height={13} rx={1} fill={color} />
      <Rect x={17} y={3} width={4} height={18} rx={1} fill={color} />
    </Svg>
  );
}
