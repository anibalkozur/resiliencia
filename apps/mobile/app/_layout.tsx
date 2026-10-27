import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { colors } from '@resiliencia/design-tokens';
import { UserProvider, useUser } from '../src/user/UserProvider';
import { isProfileComplete } from '../src/user/service';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { PrefsProvider } from '../src/prefs/PrefsProvider';

function RootNavigator() {
  const { session, authLoading } = useAuth();
  const { profile, isLoading: userLoading } = useUser();
  const profileComplete = isProfileComplete(profile);

  useEffect(() => {
    if (authLoading || (session != null && userLoading)) {
      return;
    }
    if (!session) {
      router.replace('/onboarding');
    } else if (!profileComplete) {
      router.replace('/profile-setup');
    } else {
      router.replace('/(tabs)');
    }
  }, [authLoading, profileComplete, session, userLoading]);

  if (authLoading || (session != null && userLoading)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={session != null && profileComplete}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="planes" />
      </Stack.Protected>
      <Stack.Protected guard={session != null && !profileComplete}>
        <Stack.Screen name="profile-setup" />
      </Stack.Protected>
      <Stack.Protected guard={session == null}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <PrefsProvider>
      <UserProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </UserProvider>
    </PrefsProvider>
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
