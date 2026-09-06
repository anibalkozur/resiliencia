import { Tabs } from 'expo-router';
import { colors } from '@resiliencia/design-tokens';
import HouseIcon from '../../components/icons/HouseIcon';
import DumbbellIcon from '../../components/icons/DumbbellIcon';
import UserIcon from '../../components/icons/UserIcon';
import GearIcon from '../../components/icons/GearIcon';
import ChartIcon from '../../components/icons/ChartIcon';
import BrandHeader from '../../components/BrandHeader';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: () => <BrandHeader />,
        headerShown: true,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.silverDim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <HouseIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="retos"
        options={{
          title: 'Retos',
          tabBarIcon: ({ color, size }) => <DumbbellIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, size }) => <ChartIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color, size }) => <GearIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
