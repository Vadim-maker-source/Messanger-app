
import { CallProvider } from '@/context/call-context';
import { getCurrentUser } from '@/lib/api';
import { Stack, usePathname, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import './globals.css';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();

  // Состояние загрузки — важно, чтобы не мигал интерфейс
  const [loading, setLoading] = React.useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        const isAuthScreen = pathname === '/sign-in' || pathname === '/sign-up';

        if (!currentUser && !isAuthScreen) {
          router.replace('/sign-in');
        } else if (currentUser && isAuthScreen) {
          router.replace('/(root)'); // или '/(root)/index', если нужно
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/sign-in');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4ECDC4" />
      </View>
    );
  }

  return (
    <CallProvider>
    <Stack screenOptions={{ headerShown: false }}>
      {/* Экраны аутентификации — без оболочки */}
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
        <Stack.Screen name="(root)" />
        <Stack.Screen name="active-call" options={{ headerShown: false }} />
    </Stack>
        </CallProvider>
  );
}