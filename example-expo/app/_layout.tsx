import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Entrig from '@entrig/react-native';

import { supabase } from '../src/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [entrigInitialized, setEntrigInitialized] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  // Initialize Entrig
  useEffect(() => {
    const initEntrig = async () => {
      try {
        const apiKey = process.env.EXPO_PUBLIC_ENTRIG_API_KEY;
        if (!apiKey) {
          console.warn('Entrig API key not found');
          return;
        }

        await Entrig.init({ apiKey, showForegroundNotification: false });
        setEntrigInitialized(true);
        console.log('Entrig initialized successfully');

        // Set up notification listeners
        const foregroundSub = Entrig.onForegroundNotification((event) => {
          console.log('Foreground notification:', event);
        });

        const openedSub = Entrig.onNotificationOpened((event) => {
          console.log('Notification opened:', event);
        });

        return () => {
          foregroundSub.remove();
          openedSub.remove();
        };
      } catch (error) {
        console.error('Failed to initialize Entrig:', error);
      }
    };

    initEntrig();
  }, []);

  // Handle auth state and Entrig registration
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);

      if (!entrigInitialized) return;

      if (event === 'SIGNED_IN' && s?.user) {
        try {
          await Entrig.register(s.user.id);
          console.log('User registered with Entrig:', s.user.id);
        } catch (error) {
          console.error('Failed to register with Entrig:', error);
        }
      } else if (event === 'SIGNED_OUT') {
        try {
          await Entrig.unregister();
          console.log('User unregistered from Entrig');
        } catch (error) {
          console.error('Failed to unregister from Entrig:', error);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [entrigInitialized]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(app)';

    if (!session && inAuthGroup) {
      router.replace('/sign-in');
    } else if (session && !inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
