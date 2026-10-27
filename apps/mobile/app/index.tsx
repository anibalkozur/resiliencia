import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { useUser } from '../src/user/UserProvider';
import { isProfileComplete } from '../src/user/service';

export default function RootIndex() {
  const { session, authLoading } = useAuth();
  const { profile, isLoading: userLoading } = useUser();

  if (authLoading || (session != null && userLoading)) {
    return null;
  }

  return (
    <Redirect
      href={!session ? '/onboarding' : isProfileComplete(profile) ? '/(tabs)' : '/profile-setup'}
    />
  );
}
