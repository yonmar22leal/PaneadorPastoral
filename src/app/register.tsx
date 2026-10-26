import { useChurch } from '@/context/ChurchContext';
import { calcAge } from '@/lib/attendance';
import { ChurchNetwork, ChurchServiceSlotId } from '@/types/church';
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

export default function RegisterScreen() {
  const router = useRouter();
  const { addMember, getLeadersByNetwork, servicesSchedule } = useChurch();

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [network, setNetwork] = useState<ChurchNetwork>('adulta');
  const [selectedLeaderId, setSelectedLeaderId] = useState<string>('');
  const [preferredService, setPreferredService] = useState<ChurchServiceSlotId>('domingo_adultos_1');
  const [familyName, setFamilyName] = useState('');
  const [prayerRequest, setPrayerRequest] = useState('');

  // Get available leaders for the selected network
  const availableLeaders = getLeadersByNetwork(network);

  const handleNetworkChange = (newNet: ChurchNetwork) => {
    setNetwork(newNet);
    // Suggest default service
    if (newNet === 'juvenil') {
      setPreferredService('domingo_juvenil');
    } else {
      setPreferredService('domingo_adultos_1');
    }
    // Select first leader in that network if available
    const newLeaders = getLeadersByNetwork(newNet);
    if (newLeaders.length > 0) {
      setSelectedLeaderId(newLeaders[0].id);
    } else {
      setSelectedLeaderId('');
    }
  };

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      Alert.alert('Faltan Campos', 'Por favor ingresa nombre, apellido y teléfono.');
      return;
    }

    if (!selectedLeaderId && availableLeaders.length > 0) {
      Alert.alert('Selección de Líder', 'Por favor selecciona quién es tu líder .');
      return;
    }

    if (password && password.length < 6) {
      Alert.alert('Contraseña corta', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Contraseñas no coinciden', 'Por favor verifica que ambas contraseñas sean idénticas.');
      return;
    }

    const leaderObj = availableLeaders.find((l) => l.id === selectedLeaderId);
    const leaderName = leaderObj ? `${leaderObj.firstName} ${leaderObj.lastName}` : undefined;
    const memberEmail =
      email.trim().toLowerCase() ||
      `${firstName.trim().toLowerCase().replace(/\s+/g, '')}@iglesia.org`;

    await addMember({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: memberEmail,
      role: 'member',
      network,
      gender,
      birthDate: birthDate.trim() || undefined,
      leaderId: selectedLeaderId || undefined,
      leaderName,
      familyName: familyName.trim() || `Familia ${lastName.trim()}`,
      isActive: true,
      preferredService,
      password: password.trim() || undefined,
      notes: prayerRequest.trim() ? `Petición: ${prayerRequest.trim()}` : undefined,
    });

    Alert.alert(
      '¡Inscripción Exitosa!',
      `Bienvenido(a) a la ${network === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}. Tu líder asignado es ${leaderName || 'el equipo pastoral'}. Ya eres parte del liderazgo G12.`,
      [
        {
          text: 'Continuar a la App',
          onPress: () => router.replace('/'),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Inscripción de Miembro</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner Explanatory */}
        <View style={styles.g12Banner}>
          <View style={styles.g12IconCircle}>
            <Ionicons name="git-network" size={24} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.g12BannerTitle}>Estructura y Visión G12</Text>
            <Text style={styles.g12BannerText}>
              Cada miembro pertenece a una <Text style={{ fontWeight: '700' }}>Red</Text> y cuenta con el cuidado directo de un <Text style={{ fontWeight: '700' }}>Líder de 12</Text>.
            </Text>
          </View>
        </View>

        {/* STEP 1: NETWORK SELECTION */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>1. Selecciona tu Red *</Text>
          <Text style={styles.sectionSub}>¿En cuál de nuestras dos redes te vas a congregar?</Text>

          <View style={styles.networkToggleRow}>
            {/* Adult Network */}
            <TouchableOpacity
              style={[
                styles.networkCardOption,
                network === 'adulta' && styles.networkCardOptionActiveAdult,
              ]}
              onPress={() => handleNetworkChange('adulta')}>
              <View style={[styles.networkIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="people" size={22} color="#1D4ED8" />
              </View>
              <Text
                style={[
                  styles.networkCardName,
                  network === 'adulta' && { color: '#1E3A8A', fontWeight: '800' },
                ]}>
                Red Adulta
              </Text>
              <Text style={styles.networkCardDesc}>Servicios 9:00 AM y 1:00 PM</Text>
            </TouchableOpacity>

            {/* Youth Network */}
            <TouchableOpacity
              style={[
                styles.networkCardOption,
                network === 'juvenil' && styles.networkCardOptionActiveYouth,
              ]}
              onPress={() => handleNetworkChange('juvenil')}>
              <View style={[styles.networkIcon, { backgroundColor: '#EDE9FE' }]}>
                <Ionicons name="sparkles" size={22} color="#7C3AED" />
              </View>
              <Text
                style={[
                  styles.networkCardName,
                  network === 'juvenil' && { color: '#6D28D9', fontWeight: '800' },
                ]}>
                Red Juvenil
              </Text>
              <Text style={styles.networkCardDesc}>Servicio 11:00 AM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* STEP 2: LEADER SELECTION (G12) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>2. ¿Quién es tu Líder de 12? *</Text>
          <Text style={styles.sectionSub}>
            Líderes activos registrados en la {network === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}:
          </Text>

          <View style={styles.leadersList}>
            {availableLeaders.map((lead) => {
              const isSelected = selectedLeaderId === lead.id || (!selectedLeaderId && availableLeaders[0]?.id === lead.id);

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
                      {lead.role === 'senior_pastor'
                        ? 'Pastor Principal'
                        : lead.role === 'network_pastor'
                          ? `Pastor ${network === 'juvenil' ? 'Juvenil' : 'Adultos'}`
                          : 'Líder G12'}
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

        {/* STEP 3: PREFERRED SERVICE */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>3. Servicio Habitual</Text>
          <Text style={styles.sectionSub}>Elige el servicio en el que habitualmente te congregarás:</Text>

          <View style={styles.servicesGrid}>
            {servicesSchedule.map((srv) => (
              <TouchableOpacity
                key={srv.id}
                style={[
                  styles.serviceOption,
                  preferredService === srv.id && styles.serviceOptionActive,
                ]}
                onPress={() => setPreferredService(srv.id)}>
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

        {/* STEP 4: PERSONAL DATA */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>4. Datos Personales & Contacto</Text>

          <Text style={styles.fieldLabel}>Nombre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Daniel"
            placeholderTextColor="#94A3B8"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Text style={styles.fieldLabel}>Apellido *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Mendoza"
            placeholderTextColor="#94A3B8"
            value={lastName}
            onChangeText={setLastName}
          />

          <Text style={styles.fieldLabel}>Teléfono Móvil (WhatsApp) *</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 555-0123"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
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
                👨 Masculino (Hombre)
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
                👩 Femenino (Mujer)
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

          <Text style={styles.fieldLabel}>Correo Electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="daniel.mendoza@email.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.fieldLabel}>Familia</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej: Familia Mendoza Ruiz"
            placeholderTextColor="#94A3B8"
            value={familyName}
            onChangeText={setFamilyName}
          />

          <Text style={styles.fieldLabel}>Petición de Oración (Opcional)</Text>
          <TextInput
            style={[styles.input, { height: 75 }]}
            placeholder="Escribe aquí tu petición para que tu líder y pastores oren por ti..."
            placeholderTextColor="#94A3B8"
            multiline
            value={prayerRequest}
            onChangeText={setPrayerRequest}
          />
        </View>

        {/* STEP 5: PASSWORD */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>5. Contraseña de Acceso *</Text>
          <Text style={styles.sectionSub}>Crea una contraseña segura para ingresar a tu cuenta</Text>

          <Text style={styles.fieldLabel}>Contraseña *</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#94A3B8"
              secureTextEntry={secureText}
              value={password}
              onChangeText={setPassword}
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
              onChangeText={setConfirmPassword}
            />
          </View>
        </View>

        {/* SUBMIT BUTTON */}
        <TouchableOpacity style={styles.submitButton} onPress={handleRegister} activeOpacity={0.85}>
          <Text style={styles.submitButtonText}>Completar Inscripción</Text>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
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
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  networkToggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  networkCardOption: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  networkCardOptionActiveAdult: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  networkCardOptionActiveYouth: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F5F3FF',
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
    color: '#334155',
  },
  networkCardDesc: {
    fontSize: 11,
    color: '#64748B',
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
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  leaderItemCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaderAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  leaderNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  leaderRoleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioCircleActive: {
    borderColor: '#2563EB',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2563EB',
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
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  serviceOptionActive: {
    borderColor: '#1E3A8A',
    backgroundColor: '#F1F5F9',
  },
  serviceOptionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  serviceOptionTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderOptionActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  genderOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  genderOptionTextActive: {
    color: '#1E3A8A',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 4,
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
  passwordWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
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
    color: '#0F172A',
    paddingVertical: 8,
  },
  submitButton: {
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
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
