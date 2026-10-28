import { DoodleBackground } from '@/components/doodle-background';
import { useChurch } from '@/context/ChurchContext';
import { calcAge } from '@/lib/attendance';
import { ChurchNetwork, ChurchServiceSlotId } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
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

export default function ProfileScreen() {
  const router = useRouter();
  const {
    currentUser,
    members,
    logout,
    updateUserProfile,
    getLeadersByNetwork,
    servicesSchedule,
  } = useChurch();

  // Si no hay usuario logueado, redirigir al login / inicio
  useEffect(() => {
    if (!currentUser) {
      router.replace('/');
    }
  }, [currentUser, router]);

  // Form states initialized with currentUser data
  const [firstName, setFirstName] = useState(currentUser?.firstName || '');
  const [lastName, setLastName] = useState(currentUser?.lastName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [gender, setGender] = useState<'M' | 'F'>(currentUser?.gender || 'M');
  const [birthDate, setBirthDate] = useState(currentUser?.birthDate || '');
  const [familyName, setFamilyName] = useState(currentUser?.familyName || '');
  const [network, setNetwork] = useState<ChurchNetwork>(currentUser?.network || 'adulta');
  const [preferredService, setPreferredService] = useState<ChurchServiceSlotId>(
    currentUser?.preferredService || 'domingo_adultos_1'
  );
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>(currentUser?.leaderId || '');

  // Password change states (clave actual primero, luego nueva clave)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureCurrentText, setSecureCurrentText] = useState(true);
  const [secureNewText, setSecureNewText] = useState(true);

  // Status & Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Servicios dominicales habituales (excluyendo el servicio especial de adoración de los viernes)
  const sundayServices = useMemo(
    () => servicesSchedule.filter((srv) => srv.id !== 'viernes_adoracion' && srv.day === 'Domingo'),
    [servicesSchedule]
  );

  // Available leaders for the active network
  const availableLeaders = useMemo(
    () => getLeadersByNetwork(network),
    [getLeadersByNetwork, network]
  );

  // Determinar líder efectivo
  const currentLeaderId =
    selectedLeaderId && availableLeaders.some((l) => l.id === selectedLeaderId)
      ? selectedLeaderId
      : currentUser?.leaderId && availableLeaders.some((l) => l.id === currentUser.leaderId)
        ? currentUser.leaderId
        : availableLeaders[0]?.id || '';

  const isSeniorPastor = currentUser?.role === 'senior_pastor';

  const handleNetworkChange = (newNet: ChurchNetwork) => {
    setNetwork(newNet);
    if (errorMessage) setErrorMessage(null);
    if (successMessage) setSuccessMessage(null);
    if (newNet === 'juvenil') {
      setPreferredService('domingo_juvenil');
    } else {
      setPreferredService('domingo_adultos_1');
    }
    const newLeaders = getLeadersByNetwork(newNet);
    if (newLeaders.length > 0) {
      setSelectedLeaderId(newLeaders[0].id);
    } else {
      setSelectedLeaderId('');
    }
  };

  const handleSaveProfile = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

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

    // Validar cambio de contraseña: Se debe ingresar primero la contraseña actual
    const wantsPasswordChange = currentPassword.trim() !== '' || newPassword.trim() !== '';
    if (wantsPasswordChange) {
      // 1. Validar que ingrese la clave actual
      if (!currentPassword.trim()) {
        const msg = 'Por favor ingresa tu contraseña actual para poder establecer una nueva contraseña.';
        setErrorMessage(msg);
        Alert.alert('Contraseña Actual Requerida', msg);
        return;
      }

      // 2. Verificar que la clave actual coincida con la registrada
      const savedPassword =
        currentUser?.password || members.find((m) => m.id === currentUser?.id)?.password;

      if (savedPassword && savedPassword.trim() !== '') {
        if (currentPassword.trim() !== savedPassword) {
          const msg = 'La contraseña actual no es correcta.';
          setErrorMessage(msg);
          Alert.alert('Contraseña Incorrecta', msg);
          return;
        }
      }

      // 3. Validar la nueva contraseña
      if (!newPassword.trim()) {
        const msg = 'Por favor ingresa la nueva contraseña que deseas usar.';
        setErrorMessage(msg);
        Alert.alert('Nueva Contraseña Requerida', msg);
        return;
      }

      if (newPassword.trim().length < 6) {
        const msg = 'La nueva contraseña debe tener al menos 6 caracteres.';
        setErrorMessage(msg);
        Alert.alert('Contraseña Corta', msg);
        return;
      }

      if (newPassword !== confirmPassword) {
        const msg = 'Las nuevas contraseñas no coinciden. Por favor verifica que sean idénticas.';
        setErrorMessage(msg);
        Alert.alert('Contraseñas no coinciden', msg);
        return;
      }
    }

    setIsSaving(true);
    try {
      const leaderObj = availableLeaders.find((l) => l.id === currentLeaderId);
      const leaderName = leaderObj
        ? `${leaderObj.firstName} ${leaderObj.lastName}`
        : currentUser?.leaderName;

      const result = await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        gender,
        birthDate: birthDate.trim() || undefined,
        familyName: familyName.trim() || undefined,
        preferredService,
        network,
        leaderId: !isSeniorPastor ? currentLeaderId || undefined : undefined,
        leaderName: !isSeniorPastor ? leaderName : undefined,
        password: newPassword.trim() ? newPassword.trim() : undefined,
      });

      if (!result.success) {
        const err = result.error || 'No se pudieron guardar los cambios.';
        setErrorMessage(err);
        Alert.alert('Error al Actualizar', err);
        return;
      }

      setSuccessMessage('¡Tu perfil ha sido actualizado con éxito en el dispositivo y en la nube!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (Platform.OS === 'web') {
        // En web el banner de éxito permanece visible
      } else {
        Alert.alert('¡Perfil Guardado!', 'Tus cambios han sido actualizados exitosamente.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Error inesperado al guardar el perfil.';
      setErrorMessage(msg);
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoutConfirm = () => {
    const doLogout = async () => {
      await logout();
      router.replace('/');
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' ? window.confirm('¿Deseas cerrar tu sesión?') : true;
      if (confirmed) {
        doLogout();
      }
      return;
    }

    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar Sesión', style: 'destructive', onPress: doLogout },
    ]);
  };

  const getRoleLabel = () => {
    if (!currentUser) return 'Miembro';
    if (currentUser.role === 'senior_pastor') return 'Pastor Principal';
    if (currentUser.role === 'network_pastor') {
      return currentUser.network === 'juvenil' ? 'Pastor Juvenil' : 'Pastor Adultos';
    }
    if (currentUser.generationLevel === 2 || currentUser.role === 'g12_leader') {
      return 'Líder 12';
    }
    return 'Miembro Activo';
  };

  if (!currentUser) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <DoodleBackground>
        {/* TopBar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Mi Perfil & Configuración</Text>
          <TouchableOpacity style={styles.logoutTopBtn} onPress={handleLogoutConfirm}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Profile Banner */}
          <View style={styles.heroProfileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {currentUser.firstName?.[0] || 'U'}
                {currentUser.lastName?.[0] || ''}
              </Text>
            </View>

            <Text style={styles.heroName}>
              {currentUser.firstName} {currentUser.lastName}
            </Text>
            <Text style={styles.heroEmail}>{currentUser.email}</Text>

            <View style={styles.badgesRow}>
              <View style={styles.rolePill}>
                <Ionicons name="ribbon" size={13} color="#1E3A8A" />
                <Text style={styles.rolePillText}>{getRoleLabel()}</Text>
              </View>
              <View
                style={[
                  styles.networkPill,
                  {
                    backgroundColor:
                      currentUser.network === 'juvenil' ? '#EDE9FE' : '#DBEAFE',
                  },
                ]}>
                <Ionicons
                  name={currentUser.network === 'juvenil' ? 'sparkles' : 'people'}
                  size={13}
                  color={currentUser.network === 'juvenil' ? '#7C3AED' : '#1D4ED8'}
                />
                <Text
                  style={[
                    styles.networkPillText,
                    {
                      color:
                        currentUser.network === 'juvenil' ? '#6D28D9' : '#1E3A8A',
                    },
                  ]}>
                  {currentUser.role === 'senior_pastor'
                    ? 'Todas las Redes'
                    : currentUser.network === 'juvenil'
                      ? 'Red Juvenil'
                      : 'Red Adulta'}
                </Text>
              </View>
            </View>

            {currentUser.leaderName && !isSeniorPastor && (
              <View style={styles.coverageRow}>
                <Ionicons name="shield-checkmark" size={14} color="#059669" />
                <Text style={styles.coverageText}>
                  Cobertura Pastoral: <Text style={{ fontWeight: '700' }}>{currentUser.leaderName}</Text>
                </Text>
              </View>
            )}
          </View>

          {/* Feedback Banners */}
          {errorMessage && (
            <View style={styles.errorAlertCard}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <Text style={styles.errorAlertText}>{errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successAlertCard}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.successAlertText}>{successMessage}</Text>
            </View>
          )}

          {/* SECTION 1: DATOS PERSONALES */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="person" size={18} color="#1E3A8A" />
              <Text style={styles.sectionHeaderTitle}>1. Datos Personales</Text>
            </View>

            <Text style={styles.fieldLabel}>Nombre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Daniel"
              placeholderTextColor="#94A3B8"
              value={firstName}
              onChangeText={(t) => {
                setFirstName(t);
                if (errorMessage) setErrorMessage(null);
                if (successMessage) setSuccessMessage(null);
              }}
            />

            <Text style={styles.fieldLabel}>Apellido *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Mendoza"
              placeholderTextColor="#94A3B8"
              value={lastName}
              onChangeText={(t) => {
                setLastName(t);
                if (errorMessage) setErrorMessage(null);
                if (successMessage) setSuccessMessage(null);
              }}
            />

            <Text style={styles.fieldLabel}>Teléfono Móvil (WhatsApp) *</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555-0123"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                if (errorMessage) setErrorMessage(null);
                if (successMessage) setSuccessMessage(null);
              }}
            />

            <Text style={styles.fieldLabel}>Sexo *</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
              <TouchableOpacity
                style={[styles.genderOption, gender === 'M' && styles.genderOptionActive]}
                onPress={() => {
                  setGender('M');
                  if (successMessage) setSuccessMessage(null);
                }}>
                <Text style={[styles.genderOptionText, gender === 'M' && styles.genderOptionTextActive]}>
                  👨 Masculino
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderOption, gender === 'F' && styles.genderOptionActive]}
                onPress={() => {
                  setGender('F');
                  if (successMessage) setSuccessMessage(null);
                }}>
                <Text style={[styles.genderOptionText, gender === 'F' && styles.genderOptionTextActive]}>
                  👩 Femenino
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Fecha de Nacimiento (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: 1998-05-20"
              placeholderTextColor="#94A3B8"
              value={birthDate}
              onChangeText={(t) => {
                setBirthDate(t);
                if (successMessage) setSuccessMessage(null);
              }}
            />
            {calcAge(birthDate) !== undefined && (
              <Text style={styles.ageIndicatorText}>
                Edad calculada: {calcAge(birthDate)} años{' '}
                {calcAge(birthDate)! < 14 ? '• Prejuvenil (<14)' : ''}
              </Text>
            )}

            <Text style={styles.fieldLabel}>Familia / Apellido Familiar</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Familia Mendoza Ruiz"
              placeholderTextColor="#94A3B8"
              value={familyName}
              onChangeText={(t) => {
                setFamilyName(t);
                if (successMessage) setSuccessMessage(null);
              }}
            />
          </View>

          {/* SECTION 2: SERVICIO HABITUAL */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="time" size={18} color="#1E3A8A" />
              <Text style={styles.sectionHeaderTitle}>2. Servicio Habitual al que Asistes</Text>
            </View>
            <Text style={styles.sectionSub}>
              Configura el servicio al que habitualmente te congregas los domingos:
            </Text>

            <View style={styles.servicesGrid}>
              {sundayServices.map((srv) => (
                <TouchableOpacity
                  key={srv.id}
                  style={[
                    styles.serviceOption,
                    preferredService === srv.id && styles.serviceOptionActive,
                  ]}
                  onPress={() => {
                    setPreferredService(srv.id);
                    if (successMessage) setSuccessMessage(null);
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.serviceOptionTitle,
                        preferredService === srv.id && { color: '#1E3A8A', fontWeight: '800' },
                      ]}>
                      {srv.name}
                    </Text>
                    <Text style={styles.serviceOptionTime}>
                      {srv.day} • {srv.time}
                    </Text>
                  </View>
                  {preferredService === srv.id && (
                    <Ionicons name="checkmark-circle" size={20} color="#1E3A8A" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* SECTION 3: RED Y COBERTURA (G12) */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="git-network" size={18} color="#1E3A8A" />
              <Text style={styles.sectionHeaderTitle}>3. Red y Cobertura Pastoral</Text>
            </View>
            <View style={styles.networkToggleRow}>
              <TouchableOpacity
                style={[
                  styles.networkCardOption,
                  network === 'adulta' && styles.networkCardOptionActiveAdult,
                ]}
                onPress={() => handleNetworkChange('adulta')}>
                <View style={[styles.networkIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="people" size={20} color="#1D4ED8" />
                </View>
                <Text
                  style={[
                    styles.networkCardName,
                    network === 'adulta' && { color: '#1E3A8A', fontWeight: '800' },
                  ]}>
                  Red Adulta
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.networkCardOption,
                  network === 'juvenil' && styles.networkCardOptionActiveYouth,
                ]}
                onPress={() => handleNetworkChange('juvenil')}>
                <View style={[styles.networkIcon, { backgroundColor: '#EDE9FE' }]}>
                  <Ionicons name="sparkles" size={20} color="#7C3AED" />
                </View>
                <Text
                  style={[
                    styles.networkCardName,
                    network === 'juvenil' && { color: '#6D28D9', fontWeight: '800' },
                  ]}>
                  Red Juvenil
                </Text>
              </TouchableOpacity>
            </View>

            {!isSeniorPastor && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Tu Líder de 12 Directo</Text>
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
                        onPress={() => {
                          setSelectedLeaderId(lead.id);
                          if (successMessage) setSuccessMessage(null);
                        }}>
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
                            {lead.role === 'senior_pastor'
                              ? 'Pastor Principal'
                              : lead.role === 'network_pastor'
                                ? `Pastor ${network === 'juvenil' ? 'Juvenil' : 'Adultos'}`
                                : 'Líder 12'}
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
              </>
            )}
          </View>

          {/* SECTION 4: SEGURIDAD Y CONTRASEÑA */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="lock-closed" size={18} color="#1E3A8A" />
              <Text style={styles.sectionHeaderTitle}>4. Seguridad y Contraseña</Text>
            </View>
            <Text style={styles.sectionSub}>
              Para cambiar tu contraseña, ingresa primero tu contraseña actual y luego define la nueva.
            </Text>

            {/* 1. Contraseña Actual */}
            <Text style={styles.fieldLabel}>Contraseña Actual</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Ingresa tu contraseña actual"
                placeholderTextColor="#94A3B8"
                secureTextEntry={secureCurrentText}
                value={currentPassword}
                onChangeText={(t) => {
                  setCurrentPassword(t);
                  if (errorMessage) setErrorMessage(null);
                  if (successMessage) setSuccessMessage(null);
                }}
              />
              <TouchableOpacity onPress={() => setSecureCurrentText(!secureCurrentText)}>
                <Ionicons
                  name={secureCurrentText ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* 2. Nueva Contraseña */}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Nueva Contraseña</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#94A3B8"
                secureTextEntry={secureNewText}
                value={newPassword}
                onChangeText={(t) => {
                  setNewPassword(t);
                  if (errorMessage) setErrorMessage(null);
                  if (successMessage) setSuccessMessage(null);
                }}
              />
              <TouchableOpacity onPress={() => setSecureNewText(!secureNewText)}>
                <Ionicons
                  name={secureNewText ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* 3. Confirmar Nueva Contraseña */}
            {newPassword.trim().length > 0 && (
              <>
                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Confirmar Nueva Contraseña</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Repite tu nueva contraseña"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={secureNewText}
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      if (errorMessage) setErrorMessage(null);
                      if (successMessage) setSuccessMessage(null);
                    }}
                  />
                </View>
              </>
            )}
          </View>

          {/* ACTION BUTTONS */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && { opacity: 0.8 }]}
            onPress={handleSaveProfile}
            disabled={isSaving}
            activeOpacity={0.85}>
            {isSaving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Guardando cambios...</Text>
              </View>
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Guardar Configuración</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutSecondaryButton}
            onPress={handleLogoutConfirm}
            activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            <Text style={styles.logoutSecondaryButtonText}>Cerrar Sesión</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </DoodleBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  logoutTopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#DBEAFE',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 10,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  networkPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  coverageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginTop: 4,
  },
  coverageText: {
    fontSize: 12,
    color: '#166534',
  },
  errorAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
    lineHeight: 18,
  },
  successAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  successAlertText: {
    flex: 1,
    fontSize: 13,
    color: '#15803D',
    fontWeight: '600',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  ageIndicatorText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 8,
  },
  genderOption: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  genderOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  genderOptionTextActive: {
    color: '#1E3A8A',
    fontWeight: '800',
  },
  servicesGrid: {
    gap: 8,
  },
  serviceOption: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  serviceOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1E3A8A',
    borderWidth: 2,
  },
  serviceOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  serviceOptionTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  networkToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  networkCardOption: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  networkCardOptionActiveAdult: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1D4ED8',
    borderWidth: 2,
  },
  networkCardOptionActiveYouth: {
    backgroundColor: '#F5F3FF',
    borderColor: '#7C3AED',
    borderWidth: 2,
  },
  networkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  networkCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  leadersList: {
    gap: 8,
    marginTop: 6,
  },
  leaderItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  leaderItemCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#1E3A8A',
    borderWidth: 2,
  },
  leaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  leaderNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  leaderRoleText: {
    fontSize: 12,
    color: '#64748B',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#1E3A8A',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E3A8A',
  },
  passwordWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 10,
  },
  saveButton: {
    backgroundColor: '#1E3A8A',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  logoutSecondaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 12,
  },
  logoutSecondaryButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
});
