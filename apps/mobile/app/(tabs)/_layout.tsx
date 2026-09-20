import { Tabs } from 'expo-router';
import { colors } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { translate } from '../../src/i18n/translations';
import HouseIcon from '../../components/icons/HouseIcon';
import DumbbellIcon from '../../components/icons/DumbbellIcon';
import UserIcon from '../../components/icons/UserIcon';
import GearIcon from '../../components/icons/GearIcon';
import ChartIcon from '../../components/icons/ChartIcon';
import CameraIcon from '../../components/icons/CameraIcon';
import BrandHeader from '../../components/BrandHeader';

export default function TabsLayout() {
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';

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
          title: translate(lang, 'tabs.home'),
          tabBarIcon: ({ color, size }) => <HouseIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="retos"
        options={{
          title: translate(lang, 'tabs.retos'),
          tabBarIcon: ({ color, size }) => <DumbbellIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: translate(lang, 'tabs.progreso'),
          tabBarIcon: ({ color, size }) => <ChartIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="camretos"
        options={{
          title: translate(lang, 'tabs.camretos'),
          tabBarIcon: ({ color, size }) => <CameraIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: translate(lang, 'tabs.perfil'),
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: translate(lang, 'tabs.ajustes'),
          tabBarIcon: ({ color, size }) => <GearIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
