import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createClient} from '@supabase/supabase-js';
import Config from 'react-native-config';

const supabaseUrl = 'https://trxehkmjhbdagzgznqco.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyeGVoa21qaGJkYWd6Z3pucWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk5ODk4ODYsImV4cCI6MjA2NTU2NTg4Nn0.7R-sIi7pfkrJnwVL6VRf4DwJY2H8rl0pIzRJOJjuvlU';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
