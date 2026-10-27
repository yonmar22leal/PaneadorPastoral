import { useChurch } from '@/context/ChurchContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const router = useRouter();
  const { login, quickDemoLogin } = useChurch();

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
          'Correo o contraseña incorrectos. Verifica tus datos o usa el acceso rápido de prueba.';
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

  const handleQuickDemo = async (role: Parameters<typeof quickDemoLogin>[0]) => {
    setErrorMessage(null);
    setHasPasswordError(false);
    await quickDemoLogin(role);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ImageBackground
        source={require('@/assets/images/doodle-pattern-dark.png')}
        style={styles.backgroundImage}
        imageStyle={{ opacity: 0.22 }}
        resizeMode="repeat">
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

          <View style={styles.networksBadgeRow}>
            <View style={[styles.networkPill, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="people" size={13} color="#FFFFFF" />
              <Text style={styles.networkPillText}>Red Adulta</Text>
            </View>
            <View style={[styles.networkPill, { backgroundColor: '#8B5CF6' }]}>
              <Ionicons name="sparkles" size={13} color="#FFFFFF" />
              <Text style={styles.networkPillText}>Red Juvenil</Text>
            </View>
          </View>
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
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.registerLink}>Inscribirme aquí</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Demo Access Section */}
        <View style={styles.demoSection}>
          <View style={styles.demoHeader}>
            <Ionicons name="flash" size={18} color="#F59E0B" />
            <Text style={styles.demoTitle}>Acceso Rápido de Prueba (1 Toque)</Text>
          </View>
          <Text style={styles.demoSubtitle}>
            Prueba la app de inmediato con los diferentes roles de la iglesia:
          </Text>

          <View style={styles.demoButtonsGrid}>
            {/* Pastor Principal Varones */}
            <TouchableOpacity
              style={[styles.demoRoleCard, { borderLeftColor: '#1E3A8A' }]}
              onPress={() => handleQuickDemo('pastor_jose')}>
              <View style={[styles.roleIconBox, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="ribbon" size={20} color="#1E3A8A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRoleTitle}>Pastor José Peña</Text>
                <Text style={styles.demoRoleDesc}>Pastor Principal • 12 Discípulos Varones</Text>
              </View>
            </TouchableOpacity>

            {/* Pastora Principal Mujeres */}
            <TouchableOpacity
              style={[styles.demoRoleCard, { borderLeftColor: '#DB2777' }]}
              onPress={() => handleQuickDemo('pastora_neidy')}>
              <View style={[styles.roleIconBox, { backgroundColor: '#FCE7F3' }]}>
                <Ionicons name="ribbon" size={20} color="#DB2777" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRoleTitle}>Pastora Neidy de Peña</Text>
                <Text style={styles.demoRoleDesc}>Pastora Principal • 12 Discípulas Mujeres</Text>
              </View>
            </TouchableOpacity>

            {/* Pastor Juvenil */}
            <TouchableOpacity
              style={[styles.demoRoleCard, { borderLeftColor: '#8B5CF6' }]}
              onPress={() => handleQuickDemo('pastor_josue')}>
              <View style={[styles.roleIconBox, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="sparkles" size={20} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRoleTitle}>Pastor Josué Rodríguez</Text>
                <Text style={styles.demoRoleDesc}>Pastor Red Juvenil (11 AM) • Discípulo de Pr. José</Text>
              </View>
            </TouchableOpacity>

            {/* Pastora Juvenil */}
            <TouchableOpacity
              style={[styles.demoRoleCard, { borderLeftColor: '#A855F7' }]}
              onPress={() => handleQuickDemo('pastora_norelis')}>
              <View style={[styles.roleIconBox, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="sparkles" size={20} color="#A855F7" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRoleTitle}>Pastora Norelis de Rodríguez</Text>
                <Text style={styles.demoRoleDesc}>Pastora Red Juvenil (11 AM) • Discípula de Pra. Neidy</Text>
              </View>
            </TouchableOpacity>

            {/* Pastor Adultos */}
            <TouchableOpacity
              style={[styles.demoRoleCard, { borderLeftColor: '#2563EB' }]}
              onPress={() => handleQuickDemo('pastor_carlos')}>
              <View style={[styles.roleIconBox, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="people" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRoleTitle}>Pastor Carlos Diez</Text>
                <Text style={styles.demoRoleDesc}>Pastor Red Adulta (9 AM y 1 PM) • Discípulo de Pr. José</Text>
              </View>
            </TouchableOpacity>

            {/* Pastora Adultos */}
            <TouchableOpacity
              style={[styles.demoRoleCard, { borderLeftColor: '#0EA5E9' }]}
              onPress={() => handleQuickDemo('pastora_neiyelis')}>
              <View style={[styles.roleIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Ionicons name="people" size={20} color="#0EA5E9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRoleTitle}>Pastora Neiyelis de Diez</Text>
                <Text style={styles.demoRoleDesc}>Pastora Red Adulta (9 AM y 1 PM) • Discípula de Pra. Neidy</Text>
              </View>
            </TouchableOpacity>

            {/* Líder G12 Juvenil - Yonmar Leal */}
            <TouchableOpacity
              style={[styles.demoRoleCard, { borderLeftColor: '#10B981' }]}
              onPress={() => handleQuickDemo('lider_yonmar')}>
              <View style={[styles.roleIconBox, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="person" size={20} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoRoleTitle}>Yonmar Leal</Text>
                <Text style={styles.demoRoleDesc}>Líder 12 • Red Juvenil • Cobertura: Pr. Josué</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ImageBackground>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
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
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 17,
  },
  errorAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFF5F5',
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  primaryButton: {
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 22,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
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
    color: '#64748B',
  },
  registerLink: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
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
