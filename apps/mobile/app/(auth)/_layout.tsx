import { Stack } from 'expo-router';

export const unstable_settings = {
  anchor: 'onboarding',
};

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
