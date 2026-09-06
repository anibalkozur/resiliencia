import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@resiliencia/design-tokens';
import { UserProvider, useUser } from '../src/user/UserProvider';

function RootNavigator() {
  const { profile, isLoading } = useUser();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {profile ? <Stack.Screen name="(tabs)" /> : <Stack.Screen name="onboarding" />}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <UserProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
