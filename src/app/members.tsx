import { useChurch } from '@/context/ChurchContext';
import { calcAge } from '@/lib/attendance';
import { MemberRole } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MembersScreen() {
  const { members, addMember, currentUser } = useChurch();
  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'disciples' | 'all'>('disciples');

  // New Member Form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthDate, setBirthDate] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [familyName, setFamilyName] = useState('');
  const [notes, setNotes] = useState('');

  const userNetwork = (currentUser?.network as 'adulta' | 'juvenil') || 'adulta';
  const [network, setNetwork] = useState<'adulta' | 'juvenil'>(userNetwork);
  const [networkFilter, setNetworkFilter] = useState<'my_network' | 'all'>('my_network');

  const filteredMembers = members.filter((m) => {
    // Filtrar por red por defecto (a menos que se active ver todas / apoyo)
    if (networkFilter === 'my_network' && m.network !== userNetwork) {
      return false;
    }

    // If leader mode and filtered to disciples
    if (!isPastor && filterMode === 'disciples') {
      if (m.leaderId !== currentUser?.id) return false;
    }

    const matchesRole = selectedRole === 'all' || m.role === selectedRole;
    const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
    const family = (m.familyName || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = fullName.includes(q) || family.includes(q) || m.phone.includes(q);
    return matchesRole && matchesSearch;
  });

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Llamada', `No se pudo iniciar llamada a ${phoneNumber}`);
    });
  };

  const handleWhatsApp = (phoneNumber: string, name: string) => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(
      name
    )},%20te%20saludamos%20desde%20la%20iglesia!`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp');
    });
  };

  const handleSaveMember = () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      Alert.alert('Faltan Campos', 'Por favor ingresa nombre, apellido y teléfono.');
      return;
    }

    addMember({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      gender,
      birthDate: birthDate.trim() || undefined,
      role,
      network,
      leaderId: !isPastor ? currentUser?.id : undefined,
      leaderName: !isPastor && currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined,
      familyName: familyName.trim() || `Familia ${lastName.trim()}`,
      isActive: true,
      notes: notes.trim(),
    });

    setIsAddModalOpen(false);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setBirthDate('');
    setFamilyName('');
    setNotes('');
  };

  const getRoleBadgeStyle = (r: MemberRole) => {
    switch (r) {
      case 'senior_pastor':
        return { bg: '#EDE9FE', text: '#6D28D9', label: 'Pastor Principal' };
      case 'network_pastor':
        return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Pastor de Red' };
      case 'g12_leader':
        return { bg: '#DCFCE7', text: '#047857', label: 'Líder 12' };
      case 'volunteer':
        return { bg: '#E0E7FF', text: '#4338CA', label: 'Servidor' };
      case 'visitor':
        return { bg: '#FEF3C7', text: '#B45309', label: 'Visitante' };
      default:
        return { bg: '#F1F5F9', text: '#475569', label: 'Miembro' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            {isPastor ? 'Directorio & Familias' : 'Mis 12 Discípulos'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isPastor
              ? 'Cuidado pastoral, contacto y fichas de miembros'
              : `Equipo discipular • Líder: ${currentUser?.firstName} ${currentUser?.lastName}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setIsAddModalOpen(true)}
          activeOpacity={0.8}>
          <Ionicons name="person-add" size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Añadir</Text>
        </TouchableOpacity>
      </View>

      {!isPastor && (
        <View style={styles.leaderToggleRow}>
          <TouchableOpacity
            style={[
              styles.leaderToggleBtn,
              filterMode === 'disciples' && styles.leaderToggleBtnActive,
            ]}
            onPress={() => setFilterMode('disciples')}>
            <Text
              style={[
                styles.leaderToggleText,
                filterMode === 'disciples' && styles.leaderToggleTextActive,
              ]}>
              Mis Discípulos Directos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.leaderToggleBtn,
              filterMode === 'all' && styles.leaderToggleBtnActive,
            ]}
            onPress={() => setFilterMode('all')}>
            <Text
              style={[
                styles.leaderToggleText,
                filterMode === 'all' && styles.leaderToggleTextActive,
              ]}>
              Toda la Red
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, familia o teléfono..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* SELECTOR DE RED (PREDETERMINADO: MI RED) */}
      <View style={styles.networkSelectorBar}>
        <TouchableOpacity
          style={[styles.networkTabBtn, networkFilter === 'my_network' && styles.networkTabBtnActive]}
          onPress={() => setNetworkFilter('my_network')}>
          <Ionicons
            name="people"
            size={14}
            color={networkFilter === 'my_network' ? '#FFFFFF' : '#1E3A8A'}
          />
          <Text
            style={[styles.networkTabText, networkFilter === 'my_network' && styles.networkTabTextActive]}>
            {userNetwork === 'juvenil' ? 'Red Juvenil (Mi Red)' : 'Red Adulta (Mi Red)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.networkTabBtn, networkFilter === 'all' && styles.networkTabBtnSupportActive]}
          onPress={() => setNetworkFilter('all')}>
          <Ionicons
            name={networkFilter === 'all' ? 'checkmark-circle' : 'hand-left-outline'}
            size={14}
            color={networkFilter === 'all' ? '#FFFFFF' : '#7C3AED'}
          />
          <Text
            style={[
              styles.networkTabText,
              networkFilter === 'all' && styles.networkTabTextActive,
              networkFilter !== 'all' && { color: '#7C3AED' },
            ]}>
            + Ver Apoyo de Otra Red
          </Text>
        </TouchableOpacity>
      </View>

      {/* Role Filter Chips */}
      <View style={styles.roleFilters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleChipsContent}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'senior_pastor', label: 'Pastor Principal' },
            { id: 'network_pastor', label: 'Pastores de Red' },
            { id: 'g12_leader', label: 'Líderes 12' },
            { id: 'volunteer', label: 'Servidores' },
            { id: 'member', label: 'Miembros' },
            { id: 'visitor', label: 'Visitas Nuevas' },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.roleChip,
                selectedRole === item.id && styles.roleChipActive,
              ]}
              onPress={() => setSelectedRole(item.id)}>
              <Text
                style={[
                  styles.roleChipText,
                  selectedRole === item.id && styles.roleChipTextActive,
                ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Members List */}
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filteredMembers.map((member) => {
          const badge = getRoleBadgeStyle(member.role);

          return (
            <View key={member.id} style={styles.memberCard}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {member.firstName[0]}
                    {member.lastName[0]}
                  </Text>
                </View>

                <View style={styles.memberDetails}>
                  <View style={styles.nameBadgeRow}>
                    <Text style={styles.memberName}>
                      {member.firstName} {member.lastName}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      {member.network !== userNetwork && (
                        <View style={styles.supportBadge}>
                          <Text style={styles.supportBadgeText}>
                            🤝 Apoyo · {member.network === 'juvenil' ? 'Juvenil' : 'Adulta'}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.roleBadgeText, { color: badge.text }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {member.familyName && (
                    <Text style={styles.familyNameText}>🏡 {member.familyName}</Text>
                  )}

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: member.gender === 'F' ? '#BE185D' : '#1D4ED8' }}>
                      {member.gender === 'F' ? '👩 Mujer' : '👨 Hombre'}
                    </Text>
                    {calcAge(member.birthDate) !== undefined && (
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                        • {calcAge(member.birthDate)} años {calcAge(member.birthDate)! < 14 ? '(Prejuvenil)' : ''}
                      </Text>
                    )}
                  </View>

                  {member.ministries && member.ministries.length > 0 && (
                    <View style={styles.ministryPillRow}>
                      {member.ministries.map((m, idx) => (
                        <View key={idx} style={styles.ministryPill}>
                          <Text style={styles.ministryPillText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {member.notes && (
                <View style={styles.notesContainer}>
                  <Ionicons name="chatbox-ellipses-outline" size={14} color="#64748B" />
                  <Text style={styles.notesText}>{member.notes}</Text>
                </View>
              )}

              {/* Contact Actions Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.phoneLabelRow}>
                  <Ionicons name="call-outline" size={14} color="#64748B" />
                  <Text style={styles.phoneText}>{member.phone}</Text>
                </View>

                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() => handleCall(member.phone)}>
                    <Ionicons name="call" size={16} color="#2563EB" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.iconActionBtn, { backgroundColor: '#DCFCE7' }]}
                    onPress={() =>
                      handleWhatsApp(member.phone, `${member.firstName} ${member.lastName}`)
                    }>
                    <Ionicons name="logo-whatsapp" size={17} color="#16A34A" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Modal: Add New Member */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        onRequestClose={() => setIsAddModalOpen(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Registrar Nuevo Miembro / Visita</Text>
            <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContainer}>
            <Text style={styles.formLabel}>Nombre *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: Daniel"
              value={firstName}
              onChangeText={setFirstName}
            />

            <Text style={styles.formLabel}>Apellido *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: Salazar"
              value={lastName}
              onChangeText={setLastName}
            />

            <Text style={styles.formLabel}>Teléfono Móvil (WhatsApp) *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: +1 555-0199"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.formLabel}>Correo Electrónico</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: daniel.salazar@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.formLabel}>Rol en la Iglesia</Text>
            <View style={styles.roleSelectionRow}>
              {(['member', 'visitor', 'volunteer', 'g12_leader', 'network_pastor'] as MemberRole[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.roleSelectChip,
                    role === r && styles.roleSelectChipActive,
                  ]}
                  onPress={() => setRole(r)}>
                  <Text
                    style={[
                      styles.roleSelectChipText,
                      role === r && styles.roleSelectChipTextActive,
                    ]}>
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Sexo *</Text>
            <View style={styles.roleSelectionRow}>
              <TouchableOpacity
                style={[styles.roleSelectChip, gender === 'M' && styles.roleSelectChipActive]}
                onPress={() => setGender('M')}>
                <Text style={[styles.roleSelectChipText, gender === 'M' && styles.roleSelectChipTextActive]}>
                  👨 HOMBRE (M)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleSelectChip, gender === 'F' && styles.roleSelectChipActive]}
                onPress={() => setGender('F')}>
                <Text style={[styles.roleSelectChipText, gender === 'F' && styles.roleSelectChipTextActive]}>
                  👩 MUJER (F)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.formLabel}>Fecha de Nacimiento (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: 2004-06-15"
              value={birthDate}
              onChangeText={setBirthDate}
            />
            {calcAge(birthDate) !== undefined && (
              <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '700', marginTop: -6, marginBottom: 10 }}>
                Edad calculada: {calcAge(birthDate)} años {calcAge(birthDate)! < 14 ? '• Prejuvenil (<14)' : ''}
              </Text>
            )}

            <Text style={styles.formLabel}>Red a la que pertenece *</Text>
            <View style={styles.roleSelectionRow}>
              {(['adulta', 'juvenil'] as const).map((net) => (
                <TouchableOpacity
                  key={net}
                  style={[
                    styles.roleSelectChip,
                    network === net && styles.roleSelectChipActive,
                  ]}
                  onPress={() => setNetwork(net)}>
                  <Text
                    style={[
                      styles.roleSelectChipText,
                      network === net && styles.roleSelectChipTextActive,
                    ]}>
                    {net === 'adulta' ? 'RED ADULTA' : 'RED JUVENIL'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Nombre de Familia</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Ej: Familia Salazar Morales"
              value={familyName}
              onChangeText={setFamilyName}
            />

            <Text style={styles.formLabel}>Notas de Cuidado Pastoral</Text>
            <TextInput
              style={[styles.formInput, { height: 70 }]}
              placeholder="Ej: Petición de oración por su familia, trabajo, etc."
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSaveMember}>
              <Text style={styles.submitBtnText}>Guardar en Directorio</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  leaderToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 3,
  },
  leaderToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderToggleBtnActive: {
    backgroundColor: '#1E3A8A',
  },
  leaderToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  leaderToggleTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  roleFilters: {
    marginTop: 12,
  },
  roleChipsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  roleChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  roleChipTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
  },
  memberDetails: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  familyNameText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  ministryPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  ministryPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ministryPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  notesText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  phoneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  formScroll: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
  },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  roleSelectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  roleSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  roleSelectChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  roleSelectChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  roleSelectChipTextActive: {
    color: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  networkSelectorBar: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  networkTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  networkTabBtnActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  networkTabBtnSupportActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  networkTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  networkTabTextActive: {
    color: '#FFFFFF',
  },
  supportBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  supportBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
});
