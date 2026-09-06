import { Tabs } from 'expo-router';
import { colors } from '@resiliencia/design-tokens';
import HouseIcon from '../../components/icons/HouseIcon';
import DumbbellIcon from '../../components/icons/DumbbellIcon';
import UserIcon from '../../components/icons/UserIcon';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
