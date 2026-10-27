import { useChurch } from '@/context/ChurchContext';
import { Member, Ministry } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
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
  } = useChurch();

  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

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
  const [showOtherNetworks, setShowOtherNetworks] = useState(false);

  const targetNetwork = useMemo<'adulta' | 'juvenil'>(() => {
    return (currentUser?.network as 'adulta' | 'juvenil') || 'adulta';
  }, [currentUser?.network]);

  const targetNetworkCount = useMemo(() => {
    return members.filter((m) => m.network === targetNetwork).length;
  }, [members, targetNetwork]);

  const otherNetworkCount = useMemo(() => {
    return members.filter((m) => m.network !== targetNetwork).length;
  }, [members, targetNetwork]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      if (!showOtherNetworks && m.network !== targetNetwork) {
        return false;
      }
      if (!q) return true;
      return (
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        m.phone.includes(q)
      );
    });
  }, [members, memberSearch, showOtherNetworks, targetNetwork]);

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

  const openCreateModal = () => {
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
    setCoordinatorId(m.id);
    setCoordinatorName(`${m.firstName} ${m.lastName}`);
    setCoordinatorPhone(m.phone || '');
    setMemberPickerVisible(false);
  };

  const handleSelectMyself = () => {
    if (currentUser) {
      setCoordinatorId(currentUser.id);
      setCoordinatorName(`${currentUser.firstName} ${currentUser.lastName} (Pastor)`);
      setCoordinatorPhone(currentUser.phone || '');
      setMemberPickerVisible(false);
    }
  };

  const handleSave = async () => {
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
          coordinatorId,
          coordinatorName: coordinatorName.trim(),
          coordinatorPhone: coordinatorPhone.trim() || undefined,
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
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.heroKicker}>DELEGACIÓN & EQUIPOS</Text>
            <Text style={styles.heroTitle}>Ministerios</Text>
          </View>
          {isPastor ? (
            <TouchableOpacity style={styles.addTopBtn} onPress={openCreateModal}>
              <Ionicons name="add" size={20} color="#1E3A8A" />
              <Text style={styles.addTopBtnText}>Crear</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <Text style={styles.heroSubtitle}>
          Asigna y delega coordinadores para Alabanza, Audiovisual, Protocolo y más. Cada
          coordinador podrá armar sus servidores y su cronograma en cada culto.
        </Text>
      </View>

      {/* LISTA DE MINISTERIOS */}
      <DoodleBackground style={{ backgroundColor: '#F8FAFC' }}>
      <ScrollView
        contentContainerStyle={styles.scrollList}
        showsVerticalScrollIndicator={false}>
        {ministries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="ribbon-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No hay ministerios registrados</Text>
            <Text style={styles.emptySubtitle}>
              Crea ministerios como Alabanza, Audiovisual o Protocolo para delegar la coordinación de los cultos.
            </Text>
            {isPastor && (
              <TouchableOpacity style={styles.emptyBtn} onPress={openCreateModal}>
                <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                <Text style={styles.emptyBtnText}>Crear Primer Ministerio</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          ministries.map((min) => {
            const serverCount = getServersCount(min.name);
            const isMyMinistry =
              currentUser &&
              (min.coordinatorId === currentUser.id ||
                min.coordinatorName.toLowerCase().includes(currentUser.firstName.toLowerCase()));

            return (
              <View
                key={min.id}
                style={[styles.ministryCard, { borderLeftColor: min.color || '#2563EB' }]}>
                {/* Header de la tarjeta */}
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: (min.color || '#2563EB') + '1A' },
                    ]}>
                    <Ionicons
                      name={(min.icon as any) || 'people'}
                      size={22}
                      color={min.color || '#2563EB'}
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
                    <Ionicons name="person" size={16} color="#1E3A8A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coordKicker}>COORDINADOR(A) PERMANENTE</Text>
                    <Text style={styles.coordName}>{min.coordinatorName}</Text>
                    {min.coordinatorPhone ? (
                      <Text style={styles.coordPhone}>📞 {min.coordinatorPhone}</Text>
                    ) : null}
                  </View>

                  <View style={styles.statsPill}>
                    <Ionicons name="people-outline" size={13} color="#64748B" />
                    <Text style={styles.statsPillText}>{serverCount} en lista</Text>
                  </View>
                </View>

                {/* Puestos y Roles de Servicio */}
                {min.defaultRoles && min.defaultRoles.length > 0 && (
                  <View style={styles.rolesSection}>
                    <Text style={styles.rolesSectionTitle}>Puestos de Servicio en Cultos:</Text>
                    <View style={styles.rolesChipsWrap}>
                      {min.defaultRoles.map((roleName, rIdx) => (
                        <View
                          key={rIdx}
                          style={[
                            styles.roleChipBadge,
                            { borderColor: (min.color || '#2563EB') + '44' },
                          ]}>
                          <View
                            style={[
                              styles.roleChipDot,
                              { backgroundColor: min.color || '#2563EB' },
                            ]}
                          />
                          <Text style={styles.roleChipBadgeText}>{roleName}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Footer Acciones */}
                {isPastor && (
                  <View style={styles.cardActionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtnEdit}
                      onPress={() => openEditModal(min)}>
                      <Ionicons name="create-outline" size={16} color="#2563EB" />
                      <Text style={styles.actionBtnEditText}>Editar / Delegar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnDelete}
                      onPress={() => handleDelete(min)}>
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                )}
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
              <Ionicons name="close" size={22} color="#0F172A" />
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
                style={styles.input}
                placeholder="Ej: Alabanza, Audiovisual, Protocolo, Danza..."
                placeholderTextColor="#94A3B8"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Descripción o Función</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Explica de qué se encarga este ministerio durante los cultos..."
                placeholderTextColor="#94A3B8"
                multiline
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* 2. Asignar Coordinador */}
            <View style={styles.formGroup}>
              <View style={styles.coordLabelRow}>
                <Text style={styles.inputLabel}>Coordinador Responsable *</Text>
                <TouchableOpacity onPress={handleSelectMyself}>
                  <Text style={styles.assignMyselfText}>Asignarme a mí</Text>
                </TouchableOpacity>
              </View>

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
                        color={active ? '#FFFFFF' : '#475569'}
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
                <Text style={styles.inputLabel}>Puestos de Servicio en Cultos</Text>
                <TouchableOpacity onPress={handleLoadSuggestedRoles} style={styles.suggestBtn}>
                  <Ionicons name="sparkles" size={13} color="#2563EB" />
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
                      <Ionicons name="close-circle" size={16} color="#DC2626" />
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
              <Ionicons name="information-circle" size={18} color="#2563EB" />
              <Text style={styles.noticeBoxText}>
                El coordinador permanente tendrá permisos para delegar y asignar los servidores
                a cada puesto en los cultos, y editar los bloques correspondientes en el cronograma.
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
              <Ionicons name="close" size={22} color="#0F172A" />
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

          {/* SELECTOR / BOTÓN DE RED Y APOYO */}
          <View style={styles.networkSelectorBar}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.networkTabBtn,
                !showOtherNetworks && styles.networkTabBtnActive,
              ]}
              onPress={() => setShowOtherNetworks(false)}>
              <Ionicons
                name="people"
                size={14}
                color={!showOtherNetworks ? '#FFFFFF' : '#1E3A8A'}
              />
              <Text
                style={[
                  styles.networkTabText,
                  !showOtherNetworks && styles.networkTabTextActive,
                ]}>
                {targetNetwork === 'juvenil' ? 'Red Juvenil (Mi Red)' : 'Red Adulta (Mi Red)'}
              </Text>
              <View
                style={[
                  styles.networkCountPill,
                  !showOtherNetworks && styles.networkCountPillActive,
                ]}>
                <Text
                  style={[
                    styles.networkCountPillText,
                    !showOtherNetworks && styles.networkCountPillTextActive,
                  ]}>
                  {targetNetworkCount}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.networkTabBtn,
                showOtherNetworks && styles.networkTabBtnSupportActive,
              ]}
              onPress={() => setShowOtherNetworks((prev) => !prev)}>
              <Ionicons
                name={showOtherNetworks ? 'checkmark-circle' : 'hand-left-outline'}
                size={14}
                color={showOtherNetworks ? '#FFFFFF' : '#7C3AED'}
              />
              <Text
                style={[
                  styles.networkTabText,
                  showOtherNetworks && styles.networkTabTextActive,
                  !showOtherNetworks && { color: '#7C3AED' },
                ]}>
                {showOtherNetworks ? 'Apoyo Activo' : '+ Ver Apoyo Otra Red'}
              </Text>
              <View
                style={[
                  styles.networkCountPill,
                  showOtherNetworks && styles.networkCountPillSupportActive,
                ]}>
                <Text
                  style={[
                    styles.networkCountPillText,
                    showOtherNetworks && styles.networkCountPillTextActive,
                    !showOtherNetworks && { color: '#7C3AED' },
                  ]}>
                  +{otherNetworkCount}
                </Text>
              </View>
            </TouchableOpacity>
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
                  {currentUser.role === 'senior_pastor'
                    ? 'Pastor Principal'
                    : 'Pastor de Red'}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#2563EB" />
            </TouchableOpacity>
          )}

          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
            renderItem={({ item }) => {
              const isSupport = item.network !== targetNetwork;
              return (
                <TouchableOpacity
                  style={[
                    styles.memberListItem,
                    isSupport && styles.memberListItemSupport,
                  ]}
                  onPress={() => handleSelectMember(item)}>
                  <View
                    style={[
                      styles.memberAvatar,
                      isSupport && { backgroundColor: '#F3E8FF' },
                    ]}>
                    <Text
                      style={[
                        styles.memberAvatarText,
                        isSupport && { color: '#7C3AED' },
                      ]}>
                      {item.firstName[0]}
                      {item.lastName[0] || ''}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.memberName}>
                        {item.firstName} {item.lastName}
                      </Text>
                      {isSupport && (
                        <View style={styles.supportBadge}>
                          <Text style={styles.supportBadgeText}>
                            🤝 Apoyo · Red {item.network === 'juvenil' ? 'Juvenil' : 'Adulta'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memberRole}>
                      {item.role.replace('_', ' ').toUpperCase()} · Red {item.network}
                    </Text>
                    {item.phone ? <Text style={styles.memberPhone}>📞 {item.phone}</Text> : null}
                  </View>
                  <Ionicons name="add-circle" size={22} color={isSupport ? '#7C3AED' : '#2563EB'} />
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E3A8A',
  },
  hero: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
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
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  heroKicker: {
    color: '#93C5FD',
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
    color: '#DBEAFE',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
  addTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    gap: 4,
  },
  addTopBtnText: {
    color: '#1E3A8A',
    fontWeight: '800',
    fontSize: 13,
  },
  scrollList: {
    padding: 16,
    backgroundColor: '#F8FAFC',
    minHeight: '100%',
  },
  ministryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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
    color: '#0F172A',
  },
  myRoleBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  myRoleBadgeText: {
    color: '#15803D',
    fontSize: 10,
    fontWeight: '800',
  },
  ministryDesc: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  coordinatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    gap: 10,
  },
  coordAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordKicker: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  coordName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  coordPhone: {
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  statsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statsPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 10,
  },
  actionBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 5,
  },
  actionBtnEditText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
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
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
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
    color: '#0F172A',
  },
  modalSaveBtn: {
    backgroundColor: '#1E3A8A',
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
    color: '#334155',
    marginBottom: 6,
  },
  inputHelp: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    lineHeight: 16,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
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
    color: '#2563EB',
  },
  pickerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerSelectorValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  pickerSelectorSub: {
    fontSize: 11,
    color: '#64748B',
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
    borderColor: '#0F172A',
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
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginTop: 10,
  },
  noticeBoxText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  myselfQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  myselfAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myselfTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  myselfSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
  },
  memberListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  memberRole: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  memberPhone: {
    fontSize: 11,
    color: '#2563EB',
    marginTop: 2,
    fontWeight: '600',
  },
  rolesSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rolesSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
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
    backgroundColor: '#F8FAFC',
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
    color: '#1E293B',
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
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  suggestBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
  },
  roleEditTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
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
  networkCountPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  networkCountPillActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  networkCountPillSupportActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  networkCountPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  networkCountPillTextActive: {
    color: '#FFFFFF',
  },
  memberListItemSupport: {
    borderColor: '#DDD6FE',
    backgroundColor: '#FAF5FF',
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
