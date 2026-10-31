import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const DEFAULT_SUPABASE_URL = 'https://wjzqximpxxbileziqagu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqenF4aW1weHhiaWxlemlxYWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTIzNDcsImV4cCI6MjEwODE2ODM0N30.ggM-mB9K8cki90brDxAcN10OeAZdjJgFJtqZsJ1CDDY';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

/**
 * Indica si el usuario ya configuró sus credenciales reales en el archivo .env o fallback
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('tu-proyecto') &&
    !supabaseAnonKey.includes('tu-clave') &&
    !supabaseUrl.includes('placeholder')
);

/**
 * Cliente oficial de Supabase con persistencia de sesión móvil (AsyncStorage)
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
