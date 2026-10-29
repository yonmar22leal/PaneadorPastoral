import { useChurch } from '@/context/ChurchContext';
import { Member, Ministry } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { DoodleBackground } from '@/components/doodle-background';

const PRESET_COLORS = [
  { label: 'Morado Alabanza', hex: '#8B5CF6' },
  { label: 'Azul Audiovisual', hex: '#0284C7' },
  { label: 'Esmeralda Protocolo', hex: '#10B981' },
  { label: 'Índigo Real', hex: '#4F46E5' },
  { label: 'Ámbar Cálido', hex: '#F59E0B' },
  { label: 'Rosa Salmón', hex: '#EC4899' },
  { label: 'Rojo Fuego', hex: '#DC2626' },
  { label: 'Teal Misiones', hex: '#0D9488' },
];

const PRESET_ICONS = [
  { name: 'musical-notes', label: 'Música' },
  { name: 'videocam', label: 'Audiovisual' },
  { name: 'shield-checkmark', label: 'Protocolo' },
  { name: 'people', label: 'Comunidad' },
  { name: 'flame', label: 'Oración' },
  { name: 'heart', label: 'Pastoral' },
  { name: 'book', label: 'Enseñanza' },
  { name: 'sparkles', label: 'Especial' },
];

export default function MinistriesScreen() {
  const router = useRouter();
  const {
    ministries,
    members,
    currentUser,
    addMinistry,
    updateMinistry,
    deleteMinistry,
    assignMemberToMinistry,
    removeMemberFromMinistry,
  } = useChurch();

  const isPastor = currentUser?.role === 'senior_pastor';

  const isCoordinatorOf = (min?: Ministry | null): boolean => {
    if (!min || !currentUser) return false;
    if (min.coordinatorId && min.coordinatorId === currentUser.id) return true;
    const fullName = `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase();
    if (min.coordinatorName && min.coordinatorName.trim().toLowerCase().includes(fullName)) return true;
    return false;
  };

  const canEditMinistry = (min?: Ministry | null): boolean => {
    return isPastor || isCoordinatorOf(min);
  };

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Team Modal State
  const [activeTeamMinistry, setActiveTeamMinistry] = useState<Ministry | null>(null);
  const [addServerModalVisible, setAddServerModalVisible] = useState(false);
  const [addServerSearch, setAddServerSearch] = useState('');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMinistry, setEditingMinistry] = useState<Ministry | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].hex);
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0].name);
  const [coordinatorId, setCoordinatorId] = useState('');
  const [coordinatorName, setCoordinatorName] = useState('');
  const [coordinatorPhone, setCoordinatorPhone] = useState('');
  const [rolesList, setRolesList] = useState<string[]>([]);
  const [newRoleText, setNewRoleText] = useState('');

  // Selector de Miembros Modal
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      return (
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        (m.phone ? m.phone.includes(q) : false)
      );
    });
  }, [members, memberSearch]);

  const getSuggestedRolesByName = (minName: string): string[] => {
    const lower = minName.toLowerCase();
    if (lower.includes('audio') || lower.includes('multi') || lower.includes('media') || lower.includes('video')) {
      return [
        'Consola de Sonido',
        'Videos & Pantallas',
        'Fotografía',
        'Medios & Redes',
        'Cámara 1 (Principal)',
        'Cámara 2',
        'Streaming en Vivo',
        'Iluminación',
      ];
    }
    if (lower.includes('proto') || lower.includes('ujier') || lower.includes('bienven') || lower.includes('orden')) {
      return [
        'Puerta Principal',
        'Pilar Derecho',
        'Pilar Izquierdo',
        'Pasillo Central',
        'Recolección de Ofrendas',
        'Bienvenida a Nuevos',
        'Acomodación de Filas',
        'Plataforma & Altar',
      ];
    }
    if (lower.includes('alab') || lower.includes('mús') || lower.includes('ador') || lower.includes('coro')) {
      return [
        'Voz Líder',
        'Coros',
        'Batería',
        'Bajo',
        'Guitarra Eléctrica',
        'Guitarra Acústica',
        'Piano / Teclado',
        'Director Musical',
      ];
    }
    return ['Coordinador General', 'Servidor de Apoyo', 'Líder de Turno'];
  };

  const handleAddRole = () => {
    const trimmed = newRoleText.trim();
    if (!trimmed) return;
    if (rolesList.includes(trimmed)) {
      setNewRoleText('');
      return;
    }
    setRolesList((prev) => [...prev, trimmed]);
    setNewRoleText('');
  };

  const handleRemoveRole = (roleToRemove: string) => {
    setRolesList((prev) => prev.filter((r) => r !== roleToRemove));
  };

  const handleLoadSuggestedRoles = () => {
    const suggested = getSuggestedRolesByName(name || 'audiovisual');
    setRolesList(suggested);
  };

  const filteredMinistries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ministries;
    return ministries.filter((m) => {
      return (
        m.name.toLowerCase().includes(q) ||
        (m.description ? m.description.toLowerCase().includes(q) : false) ||
        m.coordinatorName.toLowerCase().includes(q)
      );
    });
  }, [ministries, searchQuery]);

  const activeMinistryMembers = useMemo(() => {
    if (!activeTeamMinistry) return [];
    const minName = activeTeamMinistry.name.trim().toLowerCase();
    return members.filter((m) =>
      m.ministries?.some((n) => n.trim().toLowerCase() === minName)
    );
  }, [activeTeamMinistry, members]);

  const availableMembersToAdd = useMemo(() => {
    if (!activeTeamMinistry) return [];
    const minName = activeTeamMinistry.name.trim().toLowerCase();
    const q = addServerSearch.trim().toLowerCase();
    return members.filter((m) => {
      const alreadyIn = m.ministries?.some((n) => n.trim().toLowerCase() === minName);
      if (alreadyIn) return false;
      if (!q) return true;
      return (
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        (m.phone ? m.phone.includes(q) : false)
      );
    });
  }, [activeTeamMinistry, members, addServerSearch]);

  const handleAddMemberToMinistry = async (m: Member) => {
    if (!activeTeamMinistry) return;
    try {
      await assignMemberToMinistry(m.id, activeTeamMinistry.name);
      setAddServerModalVisible(false);
      setAddServerSearch('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo vincular al servidor.');
    }
  };

  const handleRemoveMemberFromMinistry = (m: Member) => {
    if (!activeTeamMinistry) return;
    const confirmMsg = `¿Deseas quitar a ${m.firstName} ${m.lastName} del ministerio ${activeTeamMinistry.name}?`;
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' ? window.confirm(confirmMsg) : true;
      if (ok) {
        removeMemberFromMinistry(m.id, activeTeamMinistry.name);
      }
      return;
    }
    Alert.alert('Quitar Servidor', confirmMsg, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => removeMemberFromMinistry(m.id, activeTeamMinistry.name),
      },
    ]);
  };

  const handleWhatsApp = (phone?: string, memberName?: string) => {
    if (!phone) {
      Alert.alert('Sin Teléfono', 'Este servidor no tiene un número registrado.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=Hola%20${encodeURIComponent(
      memberName || 'hermano(a)'
    )},%20te%20saludamos%20desde%20la%20iglesia!`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'No se pudo abrir WhatsApp.');
    });
  };

  const handleCall = (phone?: string) => {
    if (!phone) {
      Alert.alert('Sin Teléfono', 'Este servidor no tiene un número registrado.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Error', 'No se pudo iniciar la llamada.');
    });
  };

  const openTeamModal = (min: Ministry) => {
    setActiveTeamMinistry(min);
    setAddServerSearch('');
  };

  const openCreateModal = () => {
    if (!isPastor) {
      Alert.alert('Acceso restringido', 'Solo los Pastores Principales tienen autorización para crear nuevos ministerios.');
      return;
    }
    setEditingMinistry(null);
    setName('');
    setDescription('');
    setSelectedColor(PRESET_COLORS[0].hex);
    setSelectedIcon(PRESET_ICONS[0].name);
    setRolesList(getSuggestedRolesByName('audiovisual'));
    setNewRoleText('');

    // Por defecto sugerir al pastor actual como coordinador inicial
    if (currentUser) {
      setCoordinatorId(currentUser.id);
      setCoordinatorName(`${currentUser.firstName} ${currentUser.lastName}`);
      setCoordinatorPhone(currentUser.phone || '');
    } else {
      setCoordinatorId('');
      setCoordinatorName('');
      setCoordinatorPhone('');
    }
    setModalVisible(true);
  };

  const openEditModal = (min: Ministry) => {
    if (!canEditMinistry(min)) {
      Alert.alert('Acceso restringido', 'Solo los Pastores Principales o el Coordinador asignado pueden editar este ministerio.');
      return;
    }
    setEditingMinistry(min);
    setName(min.name);
    setDescription(min.description || '');
    setSelectedColor(min.color || PRESET_COLORS[0].hex);
    setSelectedIcon(min.icon || PRESET_ICONS[0].name);
    setCoordinatorId(min.coordinatorId);
    setCoordinatorName(min.coordinatorName);
    setCoordinatorPhone(min.coordinatorPhone || '');
    setRolesList(
      min.defaultRoles && min.defaultRoles.length > 0
        ? min.defaultRoles
        : getSuggestedRolesByName(min.name)
    );
    setNewRoleText('');
    setModalVisible(true);
  };

  const handleSelectMember = (m: Member) => {
    if (!isPastor) return;
    setCoordinatorId(m.id);
    setCoordinatorName(`${m.firstName} ${m.lastName}`);
    setCoordinatorPhone(m.phone || '');
    setMemberPickerVisible(false);
  };

  const handleSelectMyself = () => {
    if (!isPastor) return;
    if (currentUser) {
      setCoordinatorId(currentUser.id);
      setCoordinatorName(`${currentUser.firstName} ${currentUser.lastName} (Pastor)`);
      setCoordinatorPhone(currentUser.phone || '');
      setMemberPickerVisible(false);
    }
  };

  const handleSave = async () => {
    if (!editingMinistry && !isPastor) {
      Alert.alert('Acceso restringido', 'Solo los Pastores Principales pueden crear nuevos ministerios.');
      return;
    }
    if (editingMinistry && !canEditMinistry(editingMinistry)) {
      Alert.alert('Acceso restringido', 'Solo los Pastores Principales o el Coordinador asignado pueden editar este ministerio.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del ministerio (ej: Alabanza, Audiovisual, Protocolo).');
      return;
    }
    if (!coordinatorName.trim()) {
      Alert.alert('Coordinador requerido', 'Asigna un coordinador responsable para este ministerio.');
      return;
    }

    try {
      if (editingMinistry) {
        await updateMinistry(editingMinistry.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          color: selectedColor,
          icon: selectedIcon,
          coordinatorId: isPastor ? coordinatorId : editingMinistry.coordinatorId,
          coordinatorName: isPastor ? coordinatorName.trim() : editingMinistry.coordinatorName,
          coordinatorPhone: isPastor ? (coordinatorPhone.trim() || undefined) : editingMinistry.coordinatorPhone,
          defaultRoles: rolesList,
        });
      } else {
        await addMinistry({
          name: name.trim(),
          description: description.trim() || undefined,
          color: selectedColor,
          icon: selectedIcon,
          coordinatorId,
          coordinatorName: coordinatorName.trim(),
          coordinatorPhone: coordinatorPhone.trim() || undefined,
          defaultRoles: rolesList,
        });
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo guardar el ministerio.');
    }
  };

  const handleDelete = (min: Ministry) => {
    if (!isPastor) {
      Alert.alert('Acceso restringido', 'Solo los Pastores Principales tienen autorización para eliminar ministerios.');
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`¿Estás seguro de eliminar el ministerio "${min.name}"? Los eventos existentes conservarán su historial.`)
          : true;
      if (confirmed) {
        deleteMinistry(min.id);
      }
      return;
    }

    Alert.alert(
      'Eliminar Ministerio',
      `¿Estás seguro de eliminar el ministerio "${min.name}"? Los eventos existentes conservarán su historial.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteMinistry(min.id);
          },
        },
      ]
    );
  };

  // Contar servidores asociados a cada ministerio
  const getServersCount = (minName: string) => {
    const q = minName.toLowerCase();
    return members.filter((m) =>
      m.ministries?.some((nameItem) => nameItem.toLowerCase().includes(q))
    ).length;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />

      {/* HEADER HERO */}
      <LinearGradient
        colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 58, 138, 0.38)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/' as any);
              }
            }}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.heroKicker}>DELEGACIÓN & EQUIPOS</Text>
            <Text style={styles.heroTitle}>Ministerios</Text>
          </View>
          {isPastor ? (
            <TouchableOpacity style={styles.addTopBtn} onPress={openCreateModal}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.addTopBtnText}>Crear</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <Text style={styles.heroSubtitle}>
          Crea ministerios como Alabanza, Audiovisual, Protocolo y más. Gestiona a sus coordinadores, roles y a los miembros asignados de forma independiente.
        </Text>

        {/* Buscador de Ministerios */}
        <View style={styles.heroSearchWrap}>
          <Ionicons name="search" size={16} color="#94A3B8" />
          <TextInput
            style={styles.heroSearchInput}
            placeholder="Buscar ministerio o coordinador..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* LISTA DE MINISTERIOS */}
      <DoodleBackground>
      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}>
        {filteredMinistries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="ribbon-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No se encontraron ministerios' : 'No hay ministerios registrados'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Prueba con otro término de búsqueda.'
                : 'Crea ministerios independientes como Alabanza, Audiovisual o Protocolo para organizar a los servidores de la iglesia.'}
            </Text>
            {isPastor && (
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreateModal}>
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.emptyBtnText}>Crear Ministerio</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredMinistries.map((min) => {
            const serverCount = getServersCount(min.name);
            const isMyMinistry =
              currentUser &&
              (min.coordinatorId === currentUser.id ||
                min.coordinatorName.toLowerCase().includes(currentUser.firstName.toLowerCase()));

            return (
              <View
                key={min.id}
                style={[styles.ministryCard, { borderLeftColor: min.color || '#38BDF8' }]}>
                {/* Header de la tarjeta */}
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: (min.color || '#38BDF8') + '22' },
                    ]}>
                    <Ionicons
                      name={(min.icon as any) || 'people'}
                      size={22}
                      color={min.color || '#38BDF8'}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.titleRow}>
                      <Text style={styles.ministryName}>{min.name}</Text>
                      {isMyMinistry && (
                        <View style={styles.myRoleBadge}>
                          <Text style={styles.myRoleBadgeText}>Tu Coordinas</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.ministryDesc} numberOfLines={2}>
                      {min.description || 'Sin descripción especificada.'}
                    </Text>
                  </View>
                </View>

                {/* Coordinador Box */}
                <View style={styles.coordinatorBox}>
                  <View style={styles.coordAvatar}>
                    <Ionicons name="person" size={16} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coordKicker}>COORDINADOR(A) GENERAL</Text>
                    <Text style={styles.coordName}>{min.coordinatorName}</Text>
                    {min.coordinatorPhone ? (
                      <View style={styles.coordPhoneRow}>
                        <Text style={styles.coordPhone}>📞 {min.coordinatorPhone}</Text>
                        <TouchableOpacity
                          style={styles.quickContactBtn}
                          onPress={() => handleWhatsApp(min.coordinatorPhone, min.coordinatorName)}>
                          <Ionicons name="logo-whatsapp" size={14} color="#22C55E" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickContactBtn}
                          onPress={() => handleCall(min.coordinatorPhone)}>
                          <Ionicons name="call" size={13} color="#38BDF8" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.statsPill}
                    activeOpacity={0.8}
                    onPress={() => openTeamModal(min)}>
                    <Ionicons name="people" size={13} color="#38BDF8" />
                    <Text style={styles.statsPillText}>{serverCount} Servidores</Text>
                    <Ionicons name="chevron-forward" size={12} color="#38BDF8" />
                  </TouchableOpacity>
                </View>

                {/* Puestos y Roles de Servicio */}
                {min.defaultRoles && min.defaultRoles.length > 0 && (
                  <View style={styles.rolesSection}>
                    <Text style={styles.rolesSectionTitle}>Puestos Habituales del Ministerio:</Text>
                    <View style={styles.rolesChipsWrap}>
                      {min.defaultRoles.map((roleName, rIdx) => (
                        <View
                          key={rIdx}
                          style={[
                            styles.roleChipBadge,
                            { borderColor: (min.color || '#38BDF8') + '44' },
                          ]}>
                          <View
                            style={[
                              styles.roleChipDot,
                              { backgroundColor: min.color || '#38BDF8' },
                            ]}
                          />
                          <Text style={styles.roleChipBadgeText}>{roleName}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Footer Acciones */}
                <View style={styles.cardActionsRow}>
                  <TouchableOpacity
                    style={styles.actionBtnTeam}
                    activeOpacity={0.8}
                    onPress={() => openTeamModal(min)}>
                    <Ionicons name="people-circle-outline" size={17} color="#38BDF8" />
                    <Text style={styles.actionBtnTeamText}>Ver Equipo ({serverCount})</Text>
                  </TouchableOpacity>

                  {canEditMinistry(min) && (
                    <TouchableOpacity
                      style={styles.actionBtnAddServer}
                      activeOpacity={0.8}
                      onPress={() => {
                        setActiveTeamMinistry(min);
                        setAddServerSearch('');
                        setAddServerModalVisible(true);
                      }}>
                      <Ionicons name="person-add-outline" size={15} color="#10B981" />
                      <Text style={styles.actionBtnAddServerText}>+ Servidor</Text>
                    </TouchableOpacity>
                  )}

                  {canEditMinistry(min) && (
                    <TouchableOpacity
                      style={styles.actionBtnEdit}
                      onPress={() => openEditModal(min)}>
                      <Ionicons name="create-outline" size={16} color="#38BDF8" />
                    </TouchableOpacity>
                  )}

                  {isPastor && (
                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDelete(min)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
      </DoodleBackground>

      {/* MODAL CREAR / EDITAR MINISTERIO */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingMinistry ? 'Editar Ministerio' : 'Nuevo Ministerio'}
            </Text>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSave}>
              <Text style={styles.modalSaveBtnText}>Guardar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalScroll}
            showsVerticalScrollIndicator={false}>
            {/* 1. Datos básicos */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Nombre del Ministerio *</Text>
              <TextInput
                style={[
                  styles.input,
                  !isPastor && { opacity: 0.7, backgroundColor: 'rgba(255, 255, 255, 0.04)' },
                ]}
                placeholder="Ej: Alabanza, Audiovisual, Protocolo, Danza..."
                placeholderTextColor="#94A3B8"
                value={name}
                editable={isPastor}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Descripción o Función</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Explica de qué se encarga este ministerio durante los servicios..."
                placeholderTextColor="#94A3B8"
                multiline
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* 2. Asignar Coordinador (Solo editable por Pastores) */}
            <View style={styles.formGroup}>
              <View style={styles.coordLabelRow}>
                <Text style={styles.inputLabel}>Coordinador Responsable *</Text>
                {isPastor && (
                  <TouchableOpacity onPress={handleSelectMyself}>
                    <Text style={styles.assignMyselfText}>Asignarme a mí</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isPastor ? (
                <TouchableOpacity
                  style={styles.pickerSelector}
                  onPress={() => {
                    setMemberSearch('');
                    setMemberPickerVisible(true);
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.pickerSelectorValue,
                        !coordinatorName && { color: '#94A3B8' },
                      ]}>
                      {coordinatorName || 'Seleccionar de los pastores o miembros...'}
                    </Text>
                    {coordinatorPhone ? (
                      <Text style={styles.pickerSelectorSub}>📞 {coordinatorPhone}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>
              ) : (
                <View
                  style={[
                    styles.pickerSelector,
                    { opacity: 0.85, backgroundColor: 'rgba(255, 255, 255, 0.04)' },
                  ]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerSelectorValue}>{coordinatorName}</Text>
                    {coordinatorPhone ? (
                      <Text style={styles.pickerSelectorSub}>📞 {coordinatorPhone}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="lock-closed" size={16} color="#94A3B8" />
                </View>
              )}
            </View>

            {/* 3. Selección de Color */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Color Distintivo</Text>
              <View style={styles.colorPalette}>
                {PRESET_COLORS.map((col) => {
                  const active = selectedColor === col.hex;
                  return (
                    <TouchableOpacity
                      key={col.hex}
                      onPress={() => setSelectedColor(col.hex)}
                      style={[
                        styles.colorDot,
                        { backgroundColor: col.hex },
                        active && styles.colorDotActive,
                      ]}>
                      {active && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 4. Selección de Icono */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Icono</Text>
              <View style={styles.iconPalette}>
                {PRESET_ICONS.map((ic) => {
                  const active = selectedIcon === ic.name;
                  return (
                    <TouchableOpacity
                      key={ic.name}
                      onPress={() => setSelectedIcon(ic.name)}
                      style={[
                        styles.iconChip,
                        active && {
                          backgroundColor: selectedColor,
                          borderColor: selectedColor,
                        },
                      ]}>
                      <Ionicons
                        name={ic.name as any}
                        size={18}
                        color={active ? '#FFFFFF' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.iconChipText,
                          active && { color: '#FFFFFF', fontWeight: '700' },
                        ]}>
                        {ic.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 5. Puestos y Roles de Servicio Habituales */}
            <View style={styles.formGroup}>
              <View style={styles.roleHeaderRow}>
                <Text style={styles.inputLabel}>Puestos de Servicio en Servicios</Text>
                <TouchableOpacity onPress={handleLoadSuggestedRoles} style={styles.suggestBtn}>
                  <Ionicons name="sparkles" size={13} color="#38BDF8" />
                  <Text style={styles.suggestBtnText}>Sugerir Puestos</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inputHelp}>
                Puestos donde el coordinador asignará servidores (ej: Consola, Videos, Foto, Medios, Puerta, Pilar derecho...).
              </Text>

              {/* Lista de tags/chips con botón de borrar */}
              <View style={styles.rolesEditorWrap}>
                {rolesList.map((r, idx) => (
                  <View key={idx} style={[styles.roleEditTag, { borderColor: selectedColor }]}>
                    <Text style={styles.roleEditTagText}>{r}</Text>
                    <TouchableOpacity onPress={() => handleRemoveRole(r)} style={styles.roleRemoveBtn}>
                      <Ionicons name="close-circle" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Input para agregar nuevo puesto */}
              <View style={styles.addRoleInputRow}>
                <TextInput
                  style={styles.addRoleInput}
                  placeholder="Nuevo puesto (ej: Iluminación, Pasillo...)"
                  placeholderTextColor="#94A3B8"
                  value={newRoleText}
                  onChangeText={setNewRoleText}
                  onSubmitEditing={handleAddRole}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={[styles.addRoleBtn, { backgroundColor: selectedColor }]}
                  onPress={handleAddRole}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addRoleBtnText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.noticeBox}>
              <Ionicons name="information-circle" size={18} color="#38BDF8" />
              <Text style={styles.noticeBoxText}>
                El coordinador permanente tendrá permisos para delegar y asignar los servidores
                a cada puesto en los servicios, y editar los bloques correspondientes en el cronograma.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL SELECCIONAR MIEMBRO COORDINADOR */}
      <Modal
        visible={memberPickerVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setMemberPickerVisible(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setMemberPickerVisible(false)}
              style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Asignar Coordinador</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Buscar por nombre o teléfono..."
              placeholderTextColor="#94A3B8"
              value={memberSearch}
              onChangeText={setMemberSearch}
            />
            {memberSearch.length > 0 && (
              <TouchableOpacity onPress={() => setMemberSearch('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Opción rápida: Asignar al Pastor actual */}
          {currentUser && (
            <TouchableOpacity style={styles.myselfQuickRow} onPress={handleSelectMyself}>
              <View style={styles.myselfAvatar}>
                <Ionicons name="star" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.myselfTitle}>
                  {currentUser.firstName} {currentUser.lastName} (Tú mismo)
                </Text>
                <Text style={styles.myselfSubtitle}>
                  Pastor Principal
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#38BDF8" />
            </TouchableOpacity>
          )}

          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            renderItem={({ item }) => {
              return (
                <TouchableOpacity
                  style={styles.memberListItem}
                  onPress={() => handleSelectMember(item)}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {item.firstName[0]}
                      {item.lastName[0] || ''}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.memberName}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={styles.memberRole}>
                      {item.role.replace('_', ' ').toUpperCase()}
                    </Text>
                    {item.phone ? <Text style={styles.memberPhone}>📞 {item.phone}</Text> : null}
                  </View>
                  <Ionicons name="add-circle" size={22} color="#38BDF8" />
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* MODAL EQUIPO DE SERVIDORES DEL MINISTERIO */}
      <Modal
        visible={!!activeTeamMinistry}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveTeamMinistry(null)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setActiveTeamMinistry(null)}
              style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {activeTeamMinistry?.name || 'Equipo'}
              </Text>
              <Text style={styles.teamModalSub}>
                {activeMinistryMembers.length} Servidores en el equipo
              </Text>
            </View>
            {canEditMinistry(activeTeamMinistry) && (
              <TouchableOpacity
                style={styles.addServerTopBtn}
                onPress={() => setAddServerModalVisible(true)}>
                <Ionicons name="person-add" size={15} color="#FFFFFF" />
                <Text style={styles.addServerTopBtnText}>+ Inscribir</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Coordinador Banner */}
          {activeTeamMinistry && (
            <View style={styles.teamCoordinatorBanner}>
              <View style={styles.teamCoordLeft}>
                <Ionicons name="star" size={16} color="#F59E0B" />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.teamCoordRole}>COORDINADOR(A) A CARGO</Text>
                  <Text style={styles.teamCoordName}>{activeTeamMinistry.coordinatorName}</Text>
                </View>
              </View>
              {activeTeamMinistry.coordinatorPhone ? (
                <View style={styles.teamCoordActions}>
                  <TouchableOpacity
                    style={styles.teamActionBtn}
                    onPress={() =>
                      handleWhatsApp(
                        activeTeamMinistry.coordinatorPhone,
                        activeTeamMinistry.coordinatorName
                      )
                    }>
                    <Ionicons name="logo-whatsapp" size={18} color="#22C55E" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.teamActionBtn}
                    onPress={() => handleCall(activeTeamMinistry.coordinatorPhone)}>
                    <Ionicons name="call" size={16} color="#38BDF8" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}

          {/* Lista de Miembros / Servidores */}
          {activeMinistryMembers.length === 0 ? (
            <View style={styles.teamEmptyBox}>
              <Ionicons name="people-outline" size={48} color="#64748B" />
              <Text style={styles.teamEmptyTitle}>No hay servidores inscritos</Text>
              <Text style={styles.teamEmptySub}>
                {canEditMinistry(activeTeamMinistry)
                  ? `Pulsa en "+ Inscribir" para sumar hermanos(as) de la iglesia al ministerio de ${activeTeamMinistry?.name}.`
                  : `Aún no hay servidores registrados en el ministerio de ${activeTeamMinistry?.name}.`}
              </Text>
              {canEditMinistry(activeTeamMinistry) && (
                <TouchableOpacity
                  style={styles.teamEmptyBtn}
                  onPress={() => setAddServerModalVisible(true)}>
                  <Ionicons name="person-add" size={16} color="#FFFFFF" />
                  <Text style={styles.teamEmptyBtnText}>Inscribir Primer Servidor</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={activeMinistryMembers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={styles.serverCardItem}>
                  <View style={styles.serverAvatar}>
                    <Text style={styles.serverAvatarText}>
                      {item.firstName[0]}
                      {item.lastName[0] || ''}
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.serverName}>
                      {item.firstName} {item.lastName}
                    </Text>
                    <Text style={styles.serverRoleBadge}>
                      {item.role.replace('_', ' ').toUpperCase()}
                    </Text>
                    {item.phone ? (
                      <Text style={styles.serverPhoneText}>📞 {item.phone}</Text>
                    ) : null}
                  </View>

                  <View style={styles.serverActionsRight}>
                    {item.phone ? (
                      <>
                        <TouchableOpacity
                          style={styles.serverCircleBtn}
                          onPress={() =>
                            handleWhatsApp(item.phone, `${item.firstName} ${item.lastName}`)
                          }>
                          <Ionicons name="logo-whatsapp" size={16} color="#22C55E" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.serverCircleBtn}
                          onPress={() => handleCall(item.phone)}>
                          <Ionicons name="call" size={14} color="#38BDF8" />
                        </TouchableOpacity>
                      </>
                    ) : null}

                    {canEditMinistry(activeTeamMinistry) && (
                      <TouchableOpacity
                        style={styles.serverDeleteBtn}
                        onPress={() => handleRemoveMemberFromMinistry(item)}>
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* MODAL INSCRIBIR SERVIDOR AL MINISTERIO */}
      <Modal
        visible={addServerModalVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setAddServerModalVisible(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setAddServerModalVisible(false)}
              style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.modalTitle}>Inscribir a {activeTeamMinistry?.name}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Buscar por nombre o teléfono..."
              placeholderTextColor="#94A3B8"
              value={addServerSearch}
              onChangeText={setAddServerSearch}
            />
            {addServerSearch.length > 0 && (
              <TouchableOpacity onPress={() => setAddServerSearch('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={availableMembersToAdd}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            ListEmptyComponent={
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 14, textAlign: 'center' }}>
                  {addServerSearch
                    ? 'No se encontraron miembros con esa búsqueda.'
                    : 'Todos los miembros registrados ya forman parte de este ministerio.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.memberListItem}
                onPress={() => handleAddMemberToMinistry(item)}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {item.firstName[0]}
                    {item.lastName[0] || ''}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.memberName}>
                    {item.firstName} {item.lastName}
                  </Text>
                  <Text style={styles.memberRole}>
                    {item.role.replace('_', ' ').toUpperCase()}
                  </Text>
                  {item.phone ? <Text style={styles.memberPhone}>📞 {item.phone}</Text> : null}
                </View>
                <View style={styles.addServerPlusBtn}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addServerPlusText}>Sumar</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#070A14',
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  heroKicker: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
  addTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  addTopBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  scrollList: {
    padding: 16,
    backgroundColor: 'transparent',
    minHeight: '100%',
  },
  ministryCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ministryName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  myRoleBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  myRoleBadgeText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
  },
  ministryDesc: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  coordinatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  coordAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordKicker: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  coordName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  coordPhone: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 1,
  },
  statsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statsPillText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  actionBtnEditText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284C7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 18,
    gap: 6,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // MODAL STYLES
  modalSafeArea: {
    flex: 1,
    backgroundColor: '#070A14',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSaveBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  modalScroll: {
    padding: 20,
    paddingBottom: 60,
  },
  formGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
  },
  inputHelp: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 16,
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
  coordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  assignMyselfText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  pickerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerSelectorValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pickerSelectorSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  colorPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  iconPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconChipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  noticeBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#7DD3FC',
    lineHeight: 18,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
  },
  myselfQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  myselfAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myselfTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  myselfSubtitle: {
    fontSize: 11,
    color: '#7DD3FC',
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  memberRole: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  memberPhone: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 2,
    fontWeight: '600',
  },
  rolesSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  rolesSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rolesChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  roleChipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  roleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  suggestBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  rolesEditorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  roleEditTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
  },
  roleEditTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roleRemoveBtn: {
    padding: 2,
  },
  addRoleInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  addRoleInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#FFFFFF',
  },
  addRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addRoleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  networkSelectorBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  networkTabBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8',
  },
  networkTabBtnSupportActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#A78BFA',
  },
  networkTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  networkTabTextActive: {
    color: '#FFFFFF',
  },
  networkCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  networkCountPillActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  networkCountPillSupportActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  networkCountPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  networkCountPillTextActive: {
    color: '#FFFFFF',
  },
  memberListItemSupport: {
    borderColor: 'rgba(167, 139, 250, 0.25)',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  supportBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  supportBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C4B5FD',
  },
  heroSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    marginLeft: 8,
    paddingVertical: 0,
  },
  coordPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 8,
  },
  quickContactBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionBtnTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    gap: 6,
  },
  actionBtnTeamText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8',
  },
  actionBtnAddServer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 5,
  },
  actionBtnAddServerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  teamModalSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  addServerTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addServerTopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  teamCoordinatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  teamCoordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teamCoordRole: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  teamCoordName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 1,
  },
  teamCoordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamEmptyBox: {
    alignItems: 'center',
    padding: 32,
    marginTop: 20,
  },
  teamEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
    marginTop: 12,
  },
  teamEmptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 280,
  },
  teamEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 18,
    gap: 6,
  },
  teamEmptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  serverCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  serverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  serverName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  serverRoleBadge: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  serverPhoneText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  serverActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serverCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serverDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addServerPlusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addServerPlusText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
