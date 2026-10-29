import { AuroraBackground } from '@/components/aurora-background';
import { useChurch } from '@/context/ChurchContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LoginScreenProps {
  onGoRegister?: () => void;
}

export default function LoginScreen({ onGoRegister }: LoginScreenProps = {}) {
  const router = useRouter();
  const { login } = useChurch();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasPasswordError, setHasPasswordError] = useState(false);

  const handleLogin = async () => {
    setErrorMessage(null);
    setHasPasswordError(false);

    if (!email.trim()) {
      const msg = 'Por favor ingresa tu correo electrónico.';
      setErrorMessage(msg);
      Alert.alert('Acceso', msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password ? password.trim() : undefined);
      if (result.success) {
        router.replace('/');
      } else {
        const msg =
          result.error ||
          'Correo o contraseña incorrectos. Verifica que tus credenciales estén bien escritas.';
        setErrorMessage(msg);
        if (msg.toLowerCase().includes('contraseña')) {
          setHasPasswordError(true);
        }
        Alert.alert('Acceso Inválido', msg);
      }
    } catch (err: any) {
      const msg = err?.message || 'Error al iniciar sesión. Inténtalo de nuevo.';
      setErrorMessage(msg);
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <AuroraBackground>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <View style={styles.headerHero}>
          <View style={styles.churchIconContainer}>
            <Ionicons name="business" size={36} color="#FFFFFF" />
          </View>
          <Text style={styles.appTitle}>IEC</Text>
          <Text style={styles.appSubtitle}>
            Iglesia Emmanuel de Caja de Agua
          </Text>
        </View>

        {/* Login Card */}
        <View style={styles.cardContainer}>
          <Text style={styles.cardTitle}>Iniciar Sesión</Text>
          <Text style={styles.cardDescription}>
            Ingresa con tu cuenta pastoral o de liderazgo
          </Text>

          {/* Banner de Error Visible e Inmediato */}
          {errorMessage && (
            <View style={styles.errorAlertCard}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorAlertText}>{errorMessage}</Text>
            </View>
          )}

          {/* Email Input */}
          <Text style={styles.inputLabel}>Correo Electrónico</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              placeholder="pastor@iglesia.org"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errorMessage) setErrorMessage(null);
              }}
            />
          </View>

          {/* Password Input */}
          <Text style={styles.inputLabel}>Contraseña</Text>
          <View style={[styles.inputWrapper, hasPasswordError && styles.inputWrapperError]}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={hasPasswordError ? '#DC2626' : '#64748B'}
            />
            <TextInput
              style={styles.textInput}
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              secureTextEntry={secureText}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMessage) setErrorMessage(null);
                if (hasPasswordError) setHasPasswordError(false);
              }}
            />
            <TouchableOpacity onPress={() => setSecureText(!secureText)}>
              <Ionicons
                name={secureText ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={hasPasswordError ? '#DC2626' : '#64748B'}
              />
            </TouchableOpacity>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryButton, isSubmitting && { opacity: 0.8 }]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}>
            {isSubmitting ? (
              <Text style={styles.primaryButtonText}>Verificando...</Text>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Entrar al Sistema</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>¿Eres nuevo o no tienes cuenta? </Text>
            <TouchableOpacity
              onPress={() => {
                if (onGoRegister) {
                  onGoRegister();
                } else {
                  router.push('/register');
                }
              }}>
              <Text style={styles.registerLink}>Inscribirme aquí</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </AuroraBackground>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070A14',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerHero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
  },
  churchIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  networksBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  networkPillText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cardContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 17,
  },
  errorAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12,
    color: '#FCA5A5',
    fontWeight: '600',
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 22,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
    alignItems: 'center',
  },
  registerPrompt: {
    fontSize: 13,
    color: '#94A3B8',
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  demoSection: {
    marginHorizontal: 20,
    marginTop: 26,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  demoSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 12,
  },
  demoButtonsGrid: {
    gap: 10,
  },
  demoRoleCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderLeftWidth: 4,
  },
  roleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoRoleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  demoRoleDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});
