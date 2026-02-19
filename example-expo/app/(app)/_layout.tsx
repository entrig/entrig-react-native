import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Rooms' }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: true }} />
    </Stack>
  );
}
