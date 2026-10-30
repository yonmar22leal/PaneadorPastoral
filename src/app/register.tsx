import { DoodleBackground } from '@/components/doodle-background';
import { useChurch } from '@/context/ChurchContext';
import { calcAge } from '@/lib/attendance';
import { ChurchNetwork, ChurchServiceSlotId } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface RegisterScreenProps {
  onGoLogin?: () => void;
}

export default function RegisterScreen({ onGoLogin }: RegisterScreenProps = {}) {
  const router = useRouter();
  const { registerMember, getLeadersByNetwork } = useChurch();

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const network: ChurchNetwork = 'general';
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
  const preferredService: ChurchServiceSlotId = 'domingo_11am';
  const [familyName, setFamilyName] = useState('');

  // Status & Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available leaders across the entire congregation
  const availableLeaders = useMemo(
    () => getLeadersByNetwork(),
    [getLeadersByNetwork]
  );

  // Si no hay líder seleccionado, toma el primero automáticamente
  const currentLeaderId =
    selectedLeaderId && availableLeaders.some((l) => l.id === selectedLeaderId)
      ? selectedLeaderId
      : availableLeaders[0]?.id || '';

  const handleRegister = async () => {
    setErrorMessage(null);

    if (!firstName.trim() || !lastName.trim()) {
      const msg = 'Por favor ingresa tu nombre y apellido.';
      setErrorMessage(msg);
      Alert.alert('Faltan Campos', msg);
      return;
    }

    if (!phone.trim()) {
      const msg = 'Por favor ingresa tu número de WhatsApp / teléfono móvil.';
      setErrorMessage(msg);
      Alert.alert('Faltan Campos', msg);
      return;
    }

    if (!username.trim()) {
      const msg = 'Por favor ingresa un nombre de usuario para tu cuenta.';
      setErrorMessage(msg);
      Alert.alert('Usuario Requerido', msg);
      return;
    }

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      const msg = 'El nombre de usuario debe tener al menos 3 caracteres.';
      setErrorMessage(msg);
      Alert.alert('Usuario Inválido', msg);
      return;
    }

    const effectiveLeaderId = currentLeaderId || undefined;

    if (!effectiveLeaderId && availableLeaders.length > 0) {
      const msg = 'Por favor selecciona quién es tu líder de 12.';
      setErrorMessage(msg);
      Alert.alert('Selección de Líder', msg);
      return;
    }

    if (!password || password.length < 6) {
      const msg = 'La contraseña debe tener al menos 6 caracteres.';
      setErrorMessage(msg);
      Alert.alert('Contraseña Corta', msg);
      return;
    }

    if (password !== confirmPassword) {
      const msg = 'Las contraseñas no coinciden. Por favor verifica que sean idénticas.';
      setErrorMessage(msg);
      Alert.alert('Contraseñas no coinciden', msg);
      return;
    }

    setIsSubmitting(true);
    try {
      const leaderObj = availableLeaders.find((l) => l.id === effectiveLeaderId);
      const leaderName = leaderObj ? `${leaderObj.firstName} ${leaderObj.lastName}` : undefined;

      const result = await registerMember({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        username: cleanUsername,
        email: `${cleanUsername}@iglesia.local`,
        role: 'member',
        network,
        gender,
        birthDate: birthDate.trim() || undefined,
        leaderId: effectiveLeaderId,
        leaderName,
        familyName: familyName.trim() || `Familia ${lastName.trim()}`,
        isActive: true,
        preferredService,
        password: password.trim(),
        autoLogin: true,
      });

      if (!result.success) {
        const errorMsg = result.error || 'No se pudo crear la cuenta. Por favor verifica los datos.';
        setErrorMessage(errorMsg);
        Alert.alert('Error al Registrar', errorMsg);
        return;
      }

      // Con autoLogin: true, currentUser ya está activo en AsyncStorage y ChurchContext
      if (Platform.OS === 'web') {
        router.replace('/');
        return;
      }

      Alert.alert(
        '¡Inscripción Exitosa!',
        `Bienvenido(a) a la congregación. Tu líder asignado es ${leaderName || 'el equipo pastoral'}. Ya eres parte de la iglesia.`,
        [
          {
            text: 'Continuar a la App',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (err: any) {
      const msg = err?.message || 'Ocurrió un error inesperado al procesar la inscripción.';
      setErrorMessage(msg);
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (onGoLogin) {
      onGoLogin();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <DoodleBackground>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Inscripción de Miembro</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Banner Explanatory */}


          {/* STEP 1: LEADER SELECTION (G12) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>1. ¿Quién es tu Líder de 12? *</Text>
            <Text style={styles.sectionSub}>
              Líderes activos registrados en la congregación:
            </Text>

            <View style={styles.leadersList}>
              {availableLeaders.map((lead) => {
                const isSelected = currentLeaderId === lead.id;

                return (
                  <TouchableOpacity
                    key={lead.id}
                    style={[
                      styles.leaderItemCard,
                      isSelected && styles.leaderItemCardActive,
                    ]}
                    onPress={() => setSelectedLeaderId(lead.id)}>
                    <View style={styles.leaderAvatar}>
                      <Text style={styles.leaderAvatarText}>
                        {lead.firstName[0]}
                        {lead.lastName[0]}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaderNameText}>
                        {lead.firstName} {lead.lastName}
                      </Text>
                      <Text style={styles.leaderRoleText}>
                        {lead.role === 'senior_pastor' || lead.role === 'network_pastor'
                          ? 'Pastor Principal'
                          : 'Líder 12'}
                        {lead.disciplesCount ? ` • ${lead.disciplesCount} discípulos` : ''}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.radioCircle,
                        isSelected && styles.radioCircleActive,
                      ]}>
                      {isSelected && <View style={styles.radioInnerDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* STEP 2: PERSONAL DATA */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>2. Datos Personales & Contacto</Text>

            <Text style={styles.fieldLabel}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Daniel"
              placeholderTextColor="#94A3B8"
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                if (errorMessage) setErrorMessage(null);
              }}
            />

            <Text style={styles.fieldLabel}>Apellido *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Mendoza"
              placeholderTextColor="#94A3B8"
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                if (errorMessage) setErrorMessage(null);
              }}
            />

            <Text style={styles.fieldLabel}>Teléfono Móvil (WhatsApp) *</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555-0123"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (errorMessage) setErrorMessage(null);
              }}
            />

            <Text style={styles.fieldLabel}>Sexo *</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  gender === 'M' && styles.genderOptionActive,
                ]}
                onPress={() => setGender('M')}>
                <Text
                  style={[
                    styles.genderOptionText,
                    gender === 'M' && styles.genderOptionTextActive,
                  ]}>
                  Masculino
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.genderOption,
                  gender === 'F' && styles.genderOptionActive,
                ]}
                onPress={() => setGender('F')}>
                <Text
                  style={[
                    styles.genderOptionText,
                    gender === 'F' && styles.genderOptionTextActive,
                  ]}>
                  Femenino
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Fecha de Nacimiento (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 2004-06-15"
              placeholderTextColor="#94A3B8"
              value={birthDate}
              onChangeText={setBirthDate}
            />
            {calcAge(birthDate) !== undefined && (
              <Text
                style={{
                  fontSize: 12,
                  color: '#2563EB',
                  fontWeight: '700',
                  marginTop: -8,
                  marginBottom: 14,
                }}>
                Edad calculada: {calcAge(birthDate)} años{' '}
                {calcAge(birthDate)! < 14 ? '• Prejuvenil (<14)' : ''}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Nombre de Usuario (Para iniciar sesión) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: danielmendoza o daniel22"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={(text) => {
                setUsername(text.replace(/\s+/g, '').toLowerCase());
                if (errorMessage) setErrorMessage(null);
              }}
            />

            <Text style={styles.fieldLabel}>Familia</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Familia Mendoza Ruiz"
              placeholderTextColor="#94A3B8"
              value={familyName}
              onChangeText={setFamilyName}
            />
          </View>

          {/* STEP 3: PASSWORD */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>3. Contraseña de Acceso *</Text>
            <Text style={styles.sectionSub}>Crea una contraseña segura para ingresar a tu cuenta</Text>

            <Text style={styles.fieldLabel}>Contraseña (Mínimo 6 caracteres) *</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94A3B8"
                secureTextEntry={secureText}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />
              <TouchableOpacity onPress={() => setSecureText(!secureText)}>
                <Ionicons
                  name={secureText ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Confirmar Contraseña *</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Repite tu contraseña"
                placeholderTextColor="#94A3B8"
                secureTextEntry={secureText}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />
            </View>
          </View>

          {/* BANNER DE ERROR VISIBLE E INMEDIATO */}
          {errorMessage && (
            <View style={styles.errorAlertCard}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorAlertText}>{errorMessage}</Text>
            </View>
          )}

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && { opacity: 0.8 }]}
            onPress={handleRegister}
            disabled={isSubmitting}
            activeOpacity={0.85}>
            {isSubmitting ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Creando cuenta e ingresando...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.submitButtonText}>Completar Inscripción</Text>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>

          {/* LINK PARA VOLVER AL LOGIN */}
          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>¿Ya tienes una cuenta registrada? </Text>
            <TouchableOpacity onPress={handleBack}>
              <Text style={styles.loginLink}>Iniciar Sesión</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 60 }} />
        </ScrollView>
      </DoodleBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070A14',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  g12Banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    padding: 14,
  },
  g12IconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  g12BannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  g12BannerText: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 14,
  },
  networkToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  networkCardOption: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  networkCardOptionActiveAdult: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  networkCardOptionActiveYouth: {
    borderColor: '#A78BFA',
    backgroundColor: 'rgba(167, 139, 250, 0.12)',
  },
  networkIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  networkCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  networkCardDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  leadersList: {
    gap: 10,
  },
  leaderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 12,
  },
  leaderItemCardActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  leaderAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
  },
  leaderNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  leaderRoleText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  radioCircleActive: {
    borderColor: '#38BDF8',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8',
  },
  servicesGrid: {
    gap: 8,
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  serviceOptionActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  serviceOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  serviceOptionTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderOptionActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  genderOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  genderOptionTextActive: {
    color: '#38BDF8',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
  },
  passwordWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    paddingVertical: 8,
  },
  submitButton: {
    backgroundColor: '#0284C7',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  errorAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 13,
    color: '#FCA5A5',
    fontWeight: '600',
    lineHeight: 18,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginPrompt: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  loginLink: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
});
