import { useChurch } from '@/context/ChurchContext';
import { calcAge } from '@/lib/attendance';
import { Member, MemberRole } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import { DoodleBackground } from '@/components/doodle-background';

export default function MembersScreen() {
  const {
    members,
    addMember,
    updateMember,
    updateMembersBatch,
    currentUser,
  } = useChurch();

  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterMode, setFilterMode] = useState<'disciples' | 'all'>('disciples');

  // Formulario: Nuevo Miembro / Discípulo
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [birthDate, setBirthDate] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [familyName, setFamilyName] = useState('');
  const [notes, setNotes] = useState('');
  const [newMemberLeaderId, setNewMemberLeaderId] = useState<string | undefined>(undefined);

  // Gestión Pastoral (Bloquear y Cambiar Líder)
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [managedMember, setManagedMember] = useState<Member | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isBatchLeaderModalOpen, setIsBatchLeaderModalOpen] = useState(false);
  const [batchLeaderId, setBatchLeaderId] = useState<string>('');

  const userNetwork = (currentUser?.network as 'adulta' | 'juvenil') || 'adulta';
  const [network, setNetwork] = useState<'adulta' | 'juvenil'>(userNetwork);
  const [networkFilter, setNetworkFilter] = useState<'my_network' | 'all'>('my_network');

  const isLeaderDisciplesMode = !isPastor && filterMode === 'disciples';

  // Líderes disponibles para asignar (Pastores y Líderes de 12)
  const availableLeaders = useMemo(() => {
    return members.filter(
      (m) =>
        m.role === 'senior_pastor' ||
        m.role === 'network_pastor' ||
        m.role === 'g12_leader' ||
        m.isLeaderOf12 ||
        m.generationLevel === 2
    );
  }, [members]);

  const filteredMembers = members.filter((m) => {
    // Si es modo líder viendo únicamente su equipo de 12 (discípulos directos)
    if (isLeaderDisciplesMode) {
      if (m.leaderId !== currentUser?.id) return false;
    } else {
      // Modo Toda la Red / Directorio:
      // Los Pastores Principales pertenecen a la iglesia completa, no se excluyen por red
      const isSeniorPastor = m.role === 'senior_pastor';
      if (!isSeniorPastor && networkFilter === 'my_network' && m.network !== userNetwork) {
        return false;
      }

      if (selectedRole !== 'all') {
        if (selectedRole === 'lider_144') {
          if (m.generationLevel !== 3) return false;
        } else if (selectedRole === 'g12_leader') {
          if (m.generationLevel !== 2 && m.role !== 'g12_leader') return false;
        } else if (selectedRole === 'blocked') {
          if (m.isActive !== false) return false;
        } else if (m.role !== selectedRole) {
          return false;
        }
      }
    }

    const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
    const family = (m.familyName || '').toLowerCase();
    const usr = (m.username || '').toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      fullName.includes(q) ||
      family.includes(q) ||
      usr.includes(q) ||
      (m.phone ? m.phone.includes(q) : false);

    return matchesSearch;
  });

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert('Sin Teléfono', 'Este miembro no tiene un teléfono registrado.');
      return;
    }
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Llamada', `No se pudo iniciar llamada a ${phoneNumber}`);
    });
  };

  const handleWhatsApp = (phoneNumber: string | undefined, name: string) => {
    if (!phoneNumber) {
      Alert.alert('Sin Teléfono', 'Este miembro no tiene un número registrado para WhatsApp.');
      return;
    }
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(
      name
    )},%20te%20saludamos%20desde%20la%20iglesia!`;
    Linking.openURL(url).catch(() => {
      Alert.alert('WhatsApp', 'No se pudo abrir WhatsApp');
    });
  };

  // Selección de Foto de Perfil
  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permiso necesario',
          'Concede permiso para acceder a tus fotos y seleccionar una imagen de perfil.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const uri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setAvatarUrl(uri);
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar la imagen.');
    }
  };

  // Guardar Nuevo Miembro / Discípulo
  const handleSaveMember = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Campos requeridos', 'Por favor ingresa nombre y apellido.');
      return;
    }

    // Generar nombre de usuario si no se ingresó
    const cleanUsername =
      username.trim().toLowerCase() ||
      `${firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.floor(
        Math.random() * 899 + 100
      )}`;

    // Asignación de líder:
    // En "Mi Equipo" o cuando no es pastor, es automáticamente discípulo directo del usuario actual
    const assignedLeaderId =
      isLeaderDisciplesMode || !isPastor ? currentUser?.id : newMemberLeaderId;

    const assignedLeader = assignedLeaderId
      ? members.find((m) => m.id === assignedLeaderId)
      : undefined;

    const assignedLeaderName = assignedLeader
      ? `${assignedLeader.firstName} ${assignedLeader.lastName}`.trim()
      : isLeaderDisciplesMode && currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : undefined;

    await addMember({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: cleanUsername,
      phone: phone.trim() || undefined,
      avatarUrl: avatarUrl || undefined,
      gender,
      birthDate: birthDate.trim() || undefined,
      role: isLeaderDisciplesMode ? 'member' : role,
      network: isLeaderDisciplesMode ? userNetwork : network,
      leaderId: assignedLeaderId,
      leaderName: assignedLeaderName,
      familyName: familyName.trim() || `Familia ${lastName.trim()}`,
      isActive: true,
      notes: notes.trim(),
    });

    setIsAddModalOpen(false);
    setFirstName('');
    setLastName('');
    setUsername('');
    setPhone('');
    setAvatarUrl(null);
    setBirthDate('');
    setFamilyName('');
    setNotes('');
    setNewMemberLeaderId(undefined);

    Alert.alert(
      'Éxito',
      isLeaderDisciplesMode
        ? '¡Discípulo agregado a tu equipo exitosamente!'
        : 'Miembro registrado en el directorio.'
    );
  };

  // Gestión Pastoral Individual
  const openManageModal = (member: Member) => {
    setManagedMember(member);
    setIsManageModalOpen(true);
  };

  const handleToggleBlockMember = async (member: Member) => {
    const newActiveState = member.isActive === false ? true : false;
    await updateMember(member.id, { isActive: newActiveState });

    Alert.alert(
      newActiveState ? 'Usuario Activado' : 'Usuario Bloqueado',
      newActiveState
        ? `${member.firstName} ha sido reactivado y puede usar la app.`
        : `${member.firstName} ha sido bloqueado y no podrá iniciar sesión.`
    );

    if (managedMember?.id === member.id) {
      setManagedMember({ ...managedMember, isActive: newActiveState });
    }
  };

  const handleChangeMemberLeader = async (memberId: string, targetLeaderId: string) => {
    await updateMember(memberId, { leaderId: targetLeaderId || undefined });
    setIsManageModalOpen(false);
    Alert.alert('Líder Actualizado', 'El discípulo ha sido reasignado de cobertura exitosamente.');
  };

  // Gestión Pastoral por Lotes (Multi-selección)
  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBatchBlock = async (isActive: boolean) => {
    if (selectedMemberIds.length === 0) return;
    Alert.alert(
      isActive ? 'Activar Seleccionados' : 'Bloquear Seleccionados',
      `¿Deseas ${isActive ? 'activar' : 'bloquear'} el acceso a los ${selectedMemberIds.length} miembros seleccionados?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: isActive ? 'default' : 'destructive',
          onPress: async () => {
            await updateMembersBatch(selectedMemberIds, { isActive });
            setSelectedMemberIds([]);
            setIsSelectionMode(false);
            Alert.alert(
              'Operación completada',
              `Se ha ${isActive ? 'activado' : 'bloqueado'} a los miembros seleccionados.`
            );
          },
        },
      ]
    );
  };

  const handleBatchChangeLeader = async () => {
    if (selectedMemberIds.length === 0 || !batchLeaderId) return;
    await updateMembersBatch(selectedMemberIds, { leaderId: batchLeaderId });
    setIsBatchLeaderModalOpen(false);
    setSelectedMemberIds([]);
    setIsSelectionMode(false);
    setBatchLeaderId('');
    Alert.alert('Éxito', 'Líder reasignado a todos los miembros seleccionados.');
  };

  const getRoleBadgeStyle = (m: Member) => {
    if (m.role === 'senior_pastor') {
      return { bg: '#EDE9FE', text: '#6D28D9', label: 'Pastor Principal' };
    }
    if (m.role === 'network_pastor') {
      return { bg: '#DBEAFE', text: '#1D4ED8', label: 'Pastor de Red' };
    }
    if (m.generationLevel === 3) {
      return { bg: '#EFF6FF', text: '#2563EB', label: 'Líder 144' };
    }
    if (m.generationLevel === 4) {
      return { bg: '#F5F3FF', text: '#7C3AED', label: 'Líder 1728' };
    }
    if (m.generationLevel === 2 || m.role === 'g12_leader' || m.isLeaderOf12) {
      return { bg: '#DCFCE7', text: '#047857', label: 'Líder 12' };
    }
    if (m.role === 'volunteer') {
      return { bg: '#E0E7FF', text: '#4338CA', label: 'Servidor' };
    }
    if (m.role === 'visitor') {
      return { bg: '#FEF3C7', text: '#B45309', label: 'Visitante' };
    }
    return { bg: '#F1F5F9', text: '#475569', label: 'Miembro' };
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <DoodleBackground>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {isPastor ? 'Directorio & Familias' : 'Mis 12 Discípulos'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {isPastor
                ? 'Cuidado pastoral, bloqueo de acceso y cambio de líderes'
                : `Mi Equipo • Líder: ${currentUser?.firstName} ${currentUser?.lastName}`}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {isPastor && (
              <TouchableOpacity
                style={[
                  styles.selectModeBtn,
                  isSelectionMode && styles.selectModeBtnActive,
                ]}
                onPress={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedMemberIds([]);
                }}
                activeOpacity={0.8}>
                <Ionicons
                  name={isSelectionMode ? 'close' : 'checkbox-outline'}
                  size={16}
                  color={isSelectionMode ? '#DC2626' : '#2563EB'}
                />
                <Text
                  style={[
                    styles.selectModeBtnText,
                    isSelectionMode && { color: '#DC2626' },
                  ]}>
                  {isSelectionMode ? 'Cancelar' : 'Seleccionar'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setIsAddModalOpen(true)}
              activeOpacity={0.8}>
              <Ionicons name="person-add" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>
                {isLeaderDisciplesMode ? 'Agregar Discípulo' : 'Añadir'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isPastor && (
          <View style={styles.leaderToggleRow}>
            <TouchableOpacity
              style={[
                styles.leaderToggleBtn,
                filterMode === 'disciples' && styles.leaderToggleBtnActive,
              ]}
              onPress={() => {
                setFilterMode('disciples');
                setSelectedRole('all');
              }}>
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

        {/* Barra de Búsqueda */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, usuario, familia o teléfono..."
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

        {/* SELECTOR DE RED Y FILTROS DE ROL */}
        {!isLeaderDisciplesMode && (
          <>
            <View style={styles.networkSelectorBar}>
              <TouchableOpacity
                style={[
                  styles.networkTabBtn,
                  networkFilter === 'my_network' && styles.networkTabBtnActive,
                ]}
                onPress={() => setNetworkFilter('my_network')}>
                <Ionicons
                  name="people"
                  size={14}
                  color={networkFilter === 'my_network' ? '#FFFFFF' : '#1E3A8A'}
                />
                <Text
                  style={[
                    styles.networkTabText,
                    networkFilter === 'my_network' && styles.networkTabTextActive,
                  ]}>
                  {userNetwork === 'juvenil'
                    ? 'Red Juvenil (Mi Red)'
                    : 'Red Adulta (Mi Red)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.networkTabBtn,
                  networkFilter === 'all' && styles.networkTabBtnSupportActive,
                ]}
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

            <View style={styles.roleFilters}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.roleChipsContent}>
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'senior_pastor', label: 'Pastor Principal' },
                  { id: 'network_pastor', label: 'Pastores de Red' },
                  { id: 'g12_leader', label: 'Líderes 12' },
                  { id: 'lider_144', label: 'Líderes 144' },
                  { id: 'member', label: 'Miembros' },
                  { id: 'blocked', label: '⛔ Bloqueados' },
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
          </>
        )}

        {/* Lista de Miembros */}
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}>
          {filteredMembers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={isLeaderDisciplesMode ? 'people-outline' : 'search-outline'}
                size={48}
                color="#94A3B8"
              />
              <Text style={styles.emptyTitle}>
                {isLeaderDisciplesMode
                  ? 'Aún no tienes discípulos directos en tu equipo'
                  : 'No se encontraron personas'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {isLeaderDisciplesMode
                  ? 'Usa el botón "Agregar Discípulo" para registrar a las personas de tus 12 con su usuario y foto opcional.'
                  : 'Prueba ajustando el término de búsqueda o seleccionando otro filtro.'}
              </Text>
            </View>
          ) : (
            filteredMembers.map((member) => {
              const badge = getRoleBadgeStyle(member);
              const isBlocked = member.isActive === false;
              const isSelected = selectedMemberIds.includes(member.id);

              return (
                <TouchableOpacity
                  key={member.id}
                  activeOpacity={isSelectionMode ? 0.7 : 1}
                  onPress={() => {
                    if (isSelectionMode) {
                      toggleMemberSelection(member.id);
                    }
                  }}
                  style={[
                    styles.memberCard,
                    isBlocked && styles.memberCardBlocked,
                    isSelected && styles.memberCardSelected,
                  ]}>
                  <View style={styles.cardTop}>
                    {/* Checkbox de Selección si está en modo selección */}
                    {isSelectionMode && (
                      <TouchableOpacity
                        style={styles.selectionCheckbox}
                        onPress={() => toggleMemberSelection(member.id)}>
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? '#2563EB' : '#94A3B8'}
                        />
                      </TouchableOpacity>
                    )}

                    {/* Avatar con Imagen o Iniciales */}
                    <View
                      style={[
                        styles.avatar,
                        isBlocked && { borderColor: '#EF4444', borderWidth: 2 },
                      ]}>
                      {member.avatarUrl ? (
                        <Image
                          source={{ uri: member.avatarUrl }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <Text style={styles.avatarText}>
                          {member.firstName[0]}
                          {member.lastName[0]}
                        </Text>
                      )}
                    </View>

                    <View style={styles.memberDetails}>
                      <View style={styles.nameBadgeRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName}>
                            {member.firstName} {member.lastName}
                          </Text>
                          {member.username && (
                            <Text style={styles.memberUsername}>@{member.username}</Text>
                          )}
                        </View>

                        <View
                          style={{
                            flexDirection: 'row',
                            gap: 4,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                          }}>
                          {isBlocked && (
                            <View style={styles.blockedBadge}>
                              <Text style={styles.blockedBadgeText}>⛔ Bloqueado</Text>
                            </View>
                          )}

                          {member.network !== userNetwork &&
                            member.role !== 'senior_pastor' && (
                              <View style={styles.supportBadge}>
                                <Text style={styles.supportBadgeText}>
                                  🤝 Apoyo ·{' '}
                                  {member.network === 'juvenil' ? 'Juvenil' : 'Adulta'}
                                </Text>
                              </View>
                            )}

                          <View
                            style={[
                              styles.roleBadge,
                              { backgroundColor: badge.bg },
                            ]}>
                            <Text
                              style={[styles.roleBadgeText, { color: badge.text }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Cobertura / Líder Directo */}
                      {member.leaderName ? (
                        <Text style={styles.leaderInfoText}>
                          <Ionicons name="git-network-outline" size={12} color="#64748B" />{' '}
                          Líder: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{member.leaderName}</Text>
                        </Text>
                      ) : (
                        <Text style={[styles.leaderInfoText, { fontStyle: 'italic', color: '#94A3B8' }]}>
                          Sin líder directo asignado
                        </Text>
                      )}

                      {member.familyName && (
                        <Text style={styles.familyNameText}>🏡 {member.familyName}</Text>
                      )}

                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 3,
                        }}>
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: member.gender === 'F' ? '#BE185D' : '#1D4ED8',
                          }}>
                          {member.gender === 'F' ? '👩 Mujer' : '👨 Hombre'}
                        </Text>
                        {calcAge(member.birthDate) !== undefined && (
                          <Text
                            style={{
                              fontSize: 11,
                              color: '#64748B',
                              fontWeight: '600',
                            }}>
                            • {calcAge(member.birthDate)} años{' '}
                            {calcAge(member.birthDate)! < 14 ? '(Prejuvenil)' : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {member.notes && (
                    <View style={styles.notesContainer}>
                      <Ionicons
                        name="chatbox-ellipses-outline"
                        size={14}
                        color="#64748B"
                      />
                      <Text style={styles.notesText}>{member.notes}</Text>
                    </View>
                  )}

                  {/* Acciones de Contacto y Botón Pastoral */}
                  <View style={styles.cardFooter}>
                    <View style={styles.phoneLabelRow}>
                      <Ionicons
                        name="call-outline"
                        size={14}
                        color={member.phone ? '#64748B' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.phoneText,
                          !member.phone && { color: '#94A3B8', fontStyle: 'italic' },
                        ]}>
                        {member.phone || 'Sin teléfono registrado'}
                      </Text>
                    </View>

                    <View style={styles.contactActions}>
                      {/* Botón Pastoral de Gestión Individual */}
                      {isPastor && (
                        <TouchableOpacity
                          style={styles.pastoralManageBtn}
                          onPress={() => openManageModal(member)}
                          activeOpacity={0.8}>
                          <Ionicons name="options-outline" size={15} color="#4338CA" />
                          <Text style={styles.pastoralManageBtnText}>Gestionar</Text>
                        </TouchableOpacity>
                      )}

                      {member.phone ? (
                        <>
                          <TouchableOpacity
                            style={styles.iconActionBtn}
                            onPress={() => handleCall(member.phone)}>
                            <Ionicons name="call" size={16} color="#2563EB" />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.iconActionBtn,
                              { backgroundColor: '#DCFCE7' },
                            ]}
                            onPress={() =>
                              handleWhatsApp(
                                member.phone,
                                `${member.firstName} ${member.lastName}`
                              )
                            }>
                            <Ionicons
                              name="logo-whatsapp"
                              size={17}
                              color="#16A34A"
                            />
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Barra Flotante de Acciones en Lote para Pastores */}
        {isPastor && isSelectionMode && selectedMemberIds.length > 0 && (
          <View style={styles.floatingBatchBar}>
            <View style={styles.batchInfo}>
              <Text style={styles.batchCountText}>
                {selectedMemberIds.length}{' '}
                {selectedMemberIds.length === 1 ? 'seleccionado' : 'seleccionados'}
              </Text>
            </View>
            <View style={styles.batchButtonsRow}>
              <TouchableOpacity
                style={[styles.batchBtn, { backgroundColor: '#EF4444' }]}
                onPress={() => handleBatchBlock(false)}>
                <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                <Text style={styles.batchBtnText}>Bloquear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.batchBtn, { backgroundColor: '#10B981' }]}
                onPress={() => handleBatchBlock(true)}>
                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                <Text style={styles.batchBtnText}>Activar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.batchBtn, { backgroundColor: '#3B82F6' }]}
                onPress={() => setIsBatchLeaderModalOpen(true)}>
                <Ionicons name="git-branch" size={14} color="#FFFFFF" />
                <Text style={styles.batchBtnText}>Cambiar Líder</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* MODAL 1: Agregar Persona / Discípulo */}
        <Modal
          visible={isAddModalOpen}
          animationType="slide"
          onRequestClose={() => setIsAddModalOpen(false)}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {isLeaderDisciplesMode
                  ? 'Añadir Discípulo a mi Equipo'
                  : 'Registrar Persona en el Directorio'}
              </Text>
              <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                <Ionicons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContainer}>
              {/* Banner informativo de discípulo directo */}
              {isLeaderDisciplesMode && (
                <View style={styles.discipleAddBanner}>
                  <Ionicons name="shield-checkmark" size={20} color="#047857" />
                  <Text style={styles.discipleAddBannerText}>
                    Esta persona se registrará automáticamente como tu{' '}
                    <Text style={{ fontWeight: '800' }}>discípulo directo</Text> en tu
                    equipo de 12 (Líder:{' '}
                    {currentUser?.firstName} {currentUser?.lastName}).
                  </Text>
                </View>
              )}

              {/* Selector de Foto de Perfil Opcional */}
              <View style={styles.avatarPickerSection}>
                <View style={styles.avatarPreviewContainer}>
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.avatarPreviewImage} />
                  ) : (
                    <View style={styles.avatarPreviewPlaceholder}>
                      <Ionicons name="person" size={40} color="#94A3B8" />
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <TouchableOpacity
                    style={styles.pickPhotoBtn}
                    onPress={handlePickAvatar}
                    activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={16} color="#2563EB" />
                    <Text style={styles.pickPhotoBtnText}>
                      {avatarUrl ? 'Cambiar Foto' : 'Agregar Foto de Perfil (Opcional)'}
                    </Text>
                  </TouchableOpacity>

                  {avatarUrl && (
                    <TouchableOpacity
                      style={styles.removePhotoBtn}
                      onPress={() => setAvatarUrl(null)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={styles.formLabel}>Nombre *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: Daniel"
                placeholderTextColor="#64748B"
                value={firstName}
                onChangeText={setFirstName}
              />

              <Text style={styles.formLabel}>Apellido *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: Salazar"
                placeholderTextColor="#64748B"
                value={lastName}
                onChangeText={setLastName}
              />

              {/* Nombre de Usuario en vez de pedir correo */}
              <Text style={styles.formLabel}>Nombre de Usuario (para iniciar sesión) *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: daniels (sin espacios)"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
              <Text style={styles.fieldHelpText}>
                Este usuario permitirá a la persona iniciar sesión en la app.
              </Text>

              {/* Teléfono Opcional */}
              <Text style={styles.formLabel}>Teléfono Móvil (WhatsApp) (Opcional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: +58 412 1234567"
                placeholderTextColor="#64748B"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />

              <Text style={styles.formLabel}>Sexo *</Text>
              <View style={styles.roleSelectionRow}>
                <TouchableOpacity
                  style={[
                    styles.roleSelectChip,
                    gender === 'M' && styles.roleSelectChipActive,
                  ]}
                  onPress={() => setGender('M')}>
                  <Text
                    style={[
                      styles.roleSelectChipText,
                      gender === 'M' && styles.roleSelectChipTextActive,
                    ]}>
                    👨 HOMBRE (M)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleSelectChip,
                    gender === 'F' && styles.roleSelectChipActive,
                  ]}
                  onPress={() => setGender('F')}>
                  <Text
                    style={[
                      styles.roleSelectChipText,
                      gender === 'F' && styles.roleSelectChipTextActive,
                    ]}>
                    👩 MUJER (F)
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.formLabel}>Fecha de Nacimiento (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: 2004-06-15"
                placeholderTextColor="#64748B"
                value={birthDate}
                onChangeText={setBirthDate}
              />
              {calcAge(birthDate) !== undefined && (
                <Text
                  style={{
                    fontSize: 12,
                    color: '#38BDF8',
                    fontWeight: '700',
                    marginTop: -4,
                    marginBottom: 8,
                  }}>
                  Edad calculada: {calcAge(birthDate)} años{' '}
                  {calcAge(birthDate)! < 14 ? '• Prejuvenil (<14)' : ''}
                </Text>
              )}

              {/* Si es pastor, permitir seleccionar Rol, Red y Líder */}
              {isPastor && !isLeaderDisciplesMode && (
                <>
                  <Text style={styles.formLabel}>Líder / Cobertura Directa</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    <TouchableOpacity
                      style={[
                        styles.roleSelectChip,
                        !newMemberLeaderId && styles.roleSelectChipActive,
                      ]}
                      onPress={() => setNewMemberLeaderId(undefined)}>
                      <Text
                        style={[
                          styles.roleSelectChipText,
                          !newMemberLeaderId && styles.roleSelectChipTextActive,
                        ]}>
                        Sin Líder
                      </Text>
                    </TouchableOpacity>
                    {availableLeaders.map((lead) => (
                      <TouchableOpacity
                        key={lead.id}
                        style={[
                          styles.roleSelectChip,
                          newMemberLeaderId === lead.id && styles.roleSelectChipActive,
                        ]}
                        onPress={() => setNewMemberLeaderId(lead.id)}>
                        <Text
                          style={[
                            styles.roleSelectChipText,
                            newMemberLeaderId === lead.id &&
                              styles.roleSelectChipTextActive,
                          ]}>
                          {lead.firstName} {lead.lastName} (
                          {lead.role === 'senior_pastor'
                            ? 'Pastor P.'
                            : lead.role === 'network_pastor'
                            ? 'P. Red'
                            : 'Líder 12'}
                          )
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.formLabel}>Rol en la Iglesia</Text>
                  <View style={styles.roleSelectionRow}>
                    {(
                      [
                        'member',
                        'visitor',
                        'volunteer',
                        'g12_leader',
                        'network_pastor',
                      ] as MemberRole[]
                    ).map((r) => (
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
                </>
              )}

              <Text style={styles.formLabel}>Nombre de Familia</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ej: Familia Salazar Morales"
                placeholderTextColor="#64748B"
                value={familyName}
                onChangeText={setFamilyName}
              />

              <Text style={styles.formLabel}>Notas de Cuidado Pastoral</Text>
              <TextInput
                style={[styles.formInput, { height: 70 }]}
                placeholder="Ej: Petición de oración por su familia, trabajo, etc."
                placeholderTextColor="#64748B"
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveMember}>
                <Text style={styles.submitBtnText}>
                  {isLeaderDisciplesMode
                    ? 'Guardar Discípulo en mi Equipo'
                    : 'Guardar en Directorio'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* MODAL 2: Gestión Pastoral Individual (Bloquear / Cambiar Líder) */}
        <Modal
          visible={isManageModalOpen && !!managedMember}
          animationType="slide"
          transparent
          onRequestClose={() => setIsManageModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.manageModalCard}>
              <View style={styles.manageModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.manageModalTitle}>Gestión Pastoral</Text>
                  <Text style={styles.manageModalSubtitle}>
                    {managedMember?.firstName} {managedMember?.lastName}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setIsManageModalOpen(false)}>
                  <Ionicons name="close-circle" size={26} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {/* Estado de Acceso y Bloqueo */}
                <View style={styles.manageSection}>
                  <Text style={styles.manageSectionTitle}>Estado de Acceso</Text>
                  <View
                    style={[
                      styles.statusNoticeBox,
                      managedMember?.isActive === false
                        ? styles.statusNoticeBoxBlocked
                        : styles.statusNoticeBoxActive,
                    ]}>
                    <Ionicons
                      name={
                        managedMember?.isActive === false
                          ? 'lock-closed'
                          : 'checkmark-circle'
                      }
                      size={20}
                      color={
                        managedMember?.isActive === false ? '#DC2626' : '#16A34A'
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.statusNoticeTitle,
                          managedMember?.isActive === false && { color: '#DC2626' },
                        ]}>
                        {managedMember?.isActive === false
                          ? 'Cuenta Bloqueada'
                          : 'Cuenta Activa'}
                      </Text>
                      <Text style={styles.statusNoticeDesc}>
                        {managedMember?.isActive === false
                          ? 'El usuario no puede iniciar sesión en la aplicación.'
                          : 'El usuario tiene acceso normal con su usuario y contraseña.'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.toggleBlockBtn,
                      managedMember?.isActive === false
                        ? styles.toggleBlockBtnActive
                        : styles.toggleBlockBtnBlocked,
                    ]}
                    onPress={() =>
                      managedMember && handleToggleBlockMember(managedMember)
                    }>
                    <Ionicons
                      name={
                        managedMember?.isActive === false
                          ? 'checkmark-circle'
                          : 'ban-outline'
                      }
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.toggleBlockBtnText}>
                      {managedMember?.isActive === false
                        ? 'Desbloquear y Reactivar Cuenta'
                        : 'Bloquear Acceso a la App'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Cambio de Líder Directo */}
                <View style={styles.manageSection}>
                  <Text style={styles.manageSectionTitle}>Cambiar Líder / Cobertura</Text>
                  <Text style={styles.currentLeaderLabel}>
                    Líder actual:{' '}
                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                      {managedMember?.leaderName || 'Sin líder asignado'}
                    </Text>
                  </Text>

                  <View style={styles.leadersListContainer}>
                    <TouchableOpacity
                      style={[
                        styles.leaderOptionRow,
                        !managedMember?.leaderId && styles.leaderOptionRowSelected,
                      ]}
                      onPress={() =>
                        managedMember && handleChangeMemberLeader(managedMember.id, '')
                      }>
                      <Ionicons
                        name="remove-circle-outline"
                        size={18}
                        color={!managedMember?.leaderId ? '#2563EB' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.leaderOptionName,
                          !managedMember?.leaderId && styles.leaderOptionNameSelected,
                        ]}>
                        Sin Cobertura (Ninguno)
                      </Text>
                    </TouchableOpacity>

                    {availableLeaders.map((lead) => {
                      const isCurLeader = managedMember?.leaderId === lead.id;
                      return (
                        <TouchableOpacity
                          key={lead.id}
                          style={[
                            styles.leaderOptionRow,
                            isCurLeader && styles.leaderOptionRowSelected,
                          ]}
                          onPress={() =>
                            managedMember &&
                            handleChangeMemberLeader(managedMember.id, lead.id)
                          }>
                          <Ionicons
                            name={isCurLeader ? 'checkmark-circle' : 'person-outline'}
                            size={18}
                            color={isCurLeader ? '#2563EB' : '#64748B'}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.leaderOptionName,
                                isCurLeader && styles.leaderOptionNameSelected,
                              ]}>
                              {lead.firstName} {lead.lastName}
                            </Text>
                            <Text style={styles.leaderOptionRole}>
                              {lead.role === 'senior_pastor'
                                ? 'Pastor Principal'
                                : lead.role === 'network_pastor'
                                ? `Pastor de Red (${lead.network})`
                                : 'Líder de 12'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 3: Reasignar Líder en Lote para Seleccionados */}
        <Modal
          visible={isBatchLeaderModalOpen}
          animationType="fade"
          transparent
          onRequestClose={() => setIsBatchLeaderModalOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.manageModalCard}>
              <View style={styles.manageModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.manageModalTitle}>Cambiar Líder en Lote</Text>
                  <Text style={styles.manageModalSubtitle}>
                    Asignar nuevo líder a {selectedMemberIds.length} personas
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setIsBatchLeaderModalOpen(false);
                    setBatchLeaderId('');
                  }}>
                  <Ionicons name="close-circle" size={26} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                {availableLeaders.map((lead) => {
                  const isSelectedLead = batchLeaderId === lead.id;
                  return (
                    <TouchableOpacity
                      key={lead.id}
                      style={[
                        styles.leaderOptionRow,
                        isSelectedLead && styles.leaderOptionRowSelected,
                      ]}
                      onPress={() => setBatchLeaderId(lead.id)}>
                      <Ionicons
                        name={isSelectedLead ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelectedLead ? '#2563EB' : '#94A3B8'}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.leaderOptionName,
                            isSelectedLead && styles.leaderOptionNameSelected,
                          ]}>
                          {lead.firstName} {lead.lastName}
                        </Text>
                        <Text style={styles.leaderOptionRole}>
                          {lead.role === 'senior_pastor'
                            ? 'Pastor Principal'
                            : lead.role === 'network_pastor'
                            ? `Pastor de Red (${lead.network})`
                            : 'Líder 12'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { marginTop: 16, marginBottom: 0 },
                  !batchLeaderId && { opacity: 0.5 },
                ]}
                disabled={!batchLeaderId}
                onPress={handleBatchChangeLeader}>
                <Text style={styles.submitBtnText}>Aplicar Cambio de Líder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </DoodleBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080C16',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  selectModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  selectModeBtnActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: 'rgba(251, 113, 133, 0.4)',
  },
  selectModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  leaderToggleRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  leaderToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderToggleBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  leaderToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  leaderToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
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
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  roleChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#38BDF8',
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  roleChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 12,
  },
  memberCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  memberCardBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(251, 113, 133, 0.35)',
    opacity: 0.88,
  },
  memberCardSelected: {
    borderColor: '#38BDF8',
    borderWidth: 2,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  selectionCheckbox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4,
    paddingTop: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#38BDF8',
  },
  memberDetails: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  memberUsername: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '700',
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  blockedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
  },
  blockedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FB7185',
  },
  leaderInfoText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  familyNameText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
  },
  notesText: {
    fontSize: 11,
    color: '#94A3B8',
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
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  phoneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  phoneText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  contactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pastoralManageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  pastoralManageBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#818CF8',
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingBatchBar: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  batchInfo: {
    flex: 1,
  },
  batchCountText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  batchButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  batchBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#090D1A',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  formScroll: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
    gap: 6,
  },
  discipleAddBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 10,
  },
  discipleAddBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#34D399',
    lineHeight: 18,
  },
  avatarPickerSection: {
    alignItems: 'center',
    marginVertical: 10,
    gap: 10,
  },
  avatarPreviewContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatarPreviewImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPreviewPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  pickPhotoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  removePhotoBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 10,
  },
  fieldHelpText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  roleSelectChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  roleSelectChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  roleSelectChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  submitBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
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
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  networkTabBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  networkTabBtnSupportActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#C084FC',
  },
  networkTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  networkTabTextActive: {
    color: '#FFFFFF',
  },
  supportBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  supportBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C084FC',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  manageModalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  manageModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 14,
    marginBottom: 14,
  },
  manageModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  manageModalSubtitle: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '700',
    marginTop: 2,
  },
  manageSection: {
    marginBottom: 16,
  },
  manageSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 10,
  },
  statusNoticeBoxActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusNoticeBoxBlocked: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#34D399',
  },
  statusNoticeDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  toggleBlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  toggleBlockBtnBlocked: {
    backgroundColor: '#DC2626',
  },
  toggleBlockBtnActive: {
    backgroundColor: '#16A34A',
  },
  toggleBlockBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  currentLeaderLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
  },
  leadersListContainer: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  leaderOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  leaderOptionRowSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
  },
  leaderOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  leaderOptionNameSelected: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  leaderOptionRole: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
