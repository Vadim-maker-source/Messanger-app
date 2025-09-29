import Abovebar from '@/components/Abovebar';
import Bottombar from '@/components/Bottombar';
import Topbar from '@/components/Topbar';
import { CallProvider } from '@/context/call-context';
import { Slot, usePathname } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

export default function RootLayout() {
  const pathname = usePathname();

  const hideBarsExact = ['/SearchPage', '/profile'];

  const shouldHideBars =
    hideBarsExact.includes(pathname) || pathname.startsWith('/chat');

  return (
    <View className="flex-1 bg-[#344d67]">
      <View className="h-12 bg-[#2a3b50]">
        <Abovebar />
      </View>

      {!shouldHideBars && (
        <View>
          <Topbar />
        </View>
      )}

      <View className="flex-1">
        <CallProvider>
          <Slot />
        </CallProvider>
      </View>

      {!shouldHideBars && (
        <View className="h-16">
          <Bottombar />
        </View>
      )}
    </View>
  );
}
