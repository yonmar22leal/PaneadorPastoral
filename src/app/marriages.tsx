import { useChurch } from '@/context/ChurchContext';
import { Marriage, MarriageStatus } from '@/types/church';
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
import { LinearGradient } from 'expo-linear-gradient';
import { DoodleBackground } from '@/components/doodle-background';

const STATUS_CONFIG: Record<MarriageStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Activo', color: '#10B981', bg: 'rgba(16, 185, 129, 0.18)' },
  separated: { label: 'En Acompañamiento', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.18)' },
  widowed: { label: 'Viudo(a)', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.18)' },
  divorced: { label: 'Separado', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.18)' },
};

function calculateYearsMarried(dateStr?: string): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const weddingDate = new Date(year, month, day);
  const now = new Date();
  let years = now.getFullYear() - weddingDate.getFullYear();
  const m = now.getMonth() - weddingDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < weddingDate.getDate())) {
    years--;
  }
  return years >= 0 ? years : 0;
}

function formatWeddingDate(dateStr?: string): string {
  if (!dateStr) return 'Sin fecha registrada';
  const match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return dateStr;
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const day = parseInt(match[3], 10);
  const monthName = months[parseInt(match[2], 10) - 1] || '';
  const year = match[1];
  return `${day} de ${monthName}, ${year}`;
}

export default function MarriagesScreen() {
  const router = useRouter();
  const {
    marriages,
    members,
    currentUser,
    addMarriage,
    updateMarriage,
    deleteMarriage,
  } = useChurch();

  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  // Pastores disponibles para asignación de cobertura
  const pastorsList = useMemo(() => {
    return members.filter(
      (m) => m.role === 'senior_pastor' || m.role === 'network_pastor'
    );
  }, [members]);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'mine'>('all');

  // Modal Principal (Crear / Editar Matrimonio)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMarriage, setEditingMarriage] = useState<Marriage | null>(null);

  // Campos del Formulario
  const [husbandId, setHusbandId] = useState('');
  const [husbandName, setHusbandName] = useState('');
  const [wifeId, setWifeId] = useState('');
  const [wifeName, setWifeName] = useState('');
  const [marriageDate, setMarriageDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<MarriageStatus>('active');
  const [pastorInChargeId, setPastorInChargeId] = useState('');
  const [pastorInChargeName, setPastorInChargeName] = useState('');
  const [notes, setNotes] = useState('');

  // Selector de Miembros (Esposo o Esposa)
  const [pickerTarget, setPickerTarget] = useState<'husband' | 'wife' | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');

  // Lista de matrimonios visibles para Pastores
  const visibleMarriages = useMemo(() => {
    if (!isPastor) return [];

    let list = marriages;

    // Filtro por Cobertura ("all" vs "mine")
    if (coverageFilter === 'mine' && currentUser) {
      list = list.filter(
        (m) =>
          m.pastorInChargeId === currentUser.id ||
          m.createdById === currentUser.id
      );
    }

    // Búsqueda por nombre de cónyuges o pastor
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          m.husbandName.toLowerCase().includes(q) ||
          m.wifeName.toLowerCase().includes(q) ||
          (m.pastorInChargeName && m.pastorInChargeName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [marriages, isPastor, coverageFilter, currentUser, searchQuery]);

  // Estadísticas para Pastores
  const stats = useMemo(() => {
    const total = visibleMarriages.length;
    const active = visibleMarriages.filter((m) => m.status === 'active').length;
    const currentMonth = new Date().getMonth() + 1;
    const thisMonthAnniversaries = visibleMarriages.filter((m) => {
      if (!m.marriageDate) return false;
      const match = m.marriageDate.match(/^\d{4}-(\d{1,2})-\d{1,2}$/);
      if (!match) return false;
      return parseInt(match[1], 10) === currentMonth;
    }).length;

    return { total, active, thisMonthAnniversaries };
  }, [visibleMarriages]);

  // Filtrado de miembros en el picker modal
  const pickerFilteredMembers = useMemo(() => {
    if (!pickerTarget) return [];
    const q = pickerSearch.toLowerCase().trim();
    return members
      .filter((m) => {
        // Filtrar según género si está especificado
        if (pickerTarget === 'husband' && m.gender === 'F') return false;
        if (pickerTarget === 'wife' && m.gender === 'M') return false;
        // No permitir seleccionar el mismo que ya está en el otro campo
        if (pickerTarget === 'husband' && wifeId && m.id === wifeId) return false;
        if (pickerTarget === 'wife' && husbandId && m.id === husbandId) return false;

        if (!q) return true;
        const full = `${m.firstName} ${m.lastName}`.toLowerCase();
        return full.includes(q) || (m.phone && m.phone.includes(q));
      })
      .slice(0, 30);
  }, [members, pickerTarget, pickerSearch, husbandId, wifeId]);

  const handleOpenCreate = () => {
    setEditingMarriage(null);
    setHusbandId('');
    setHusbandName('');
    setWifeId('');
    setWifeName('');
    setMarriageDate('');
    setSelectedStatus('active');
    // Pre-asignar al pastor actual si es pastor
    if (isPastor && currentUser) {
      setPastorInChargeId(currentUser.id);
      setPastorInChargeName(`${currentUser.firstName} ${currentUser.lastName}`.trim());
    } else {
      setPastorInChargeId('');
      setPastorInChargeName('');
    }
    setNotes('');
    setModalVisible(true);
  };

  const handleOpenEdit = (item: Marriage) => {
    setEditingMarriage(item);
    setHusbandId(item.husbandId);
    setHusbandName(item.husbandName);
    setWifeId(item.wifeId);
    setWifeName(item.wifeName);
    setMarriageDate(item.marriageDate || '');
    setSelectedStatus(item.status);
    setPastorInChargeId(item.pastorInChargeId || '');
    setPastorInChargeName(item.pastorInChargeName || '');
    setNotes(item.notes || '');
    setModalVisible(true);
  };

  const handleSelectMember = (member: (typeof members)[0]) => {
    const fullName = `${member.firstName} ${member.lastName}`.trim();
    if (pickerTarget === 'husband') {
      setHusbandId(member.id);
      setHusbandName(fullName);
    } else if (pickerTarget === 'wife') {
      setWifeId(member.id);
      setWifeName(fullName);
    }
    setPickerTarget(null);
    setPickerSearch('');
  };

  const handleSaveMarriage = async () => {
    if (!husbandId || !husbandName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Por favor selecciona al Esposo.');
      } else {
        Alert.alert('Faltan Datos', 'Por favor selecciona al Esposo.');
      }
      return;
    }

    if (!wifeId || !wifeName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('Por favor selecciona a la Esposa.');
      } else {
        Alert.alert('Faltan Datos', 'Por favor selecciona a la Esposa.');
      }
      return;
    }

    if (husbandId === wifeId) {
      if (Platform.OS === 'web') {
        window.alert('El esposo y la esposa no pueden ser el mismo miembro.');
      } else {
        Alert.alert('Conflicto', 'El esposo y la esposa no pueden ser el mismo miembro.');
      }
      return;
    }

    // Formatear fecha si se introdujo
    let formattedDate = marriageDate.trim();
    if (formattedDate) {
      // Si viene como DD/MM/YYYY o DD-MM-YYYY, convertir a YYYY-MM-DD
      const dmy = formattedDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) {
        formattedDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      }
    }

    try {
      if (editingMarriage) {
        await updateMarriage(editingMarriage.id, {
          husbandId,
          husbandName,
          wifeId,
          wifeName,
          marriageDate: formattedDate || undefined,
          status: selectedStatus,
          network: 'juvenil',
          pastorInChargeId: pastorInChargeId || undefined,
          pastorInChargeName: pastorInChargeName || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await addMarriage({
          husbandId,
          husbandName,
          wifeId,
          wifeName,
          marriageDate: formattedDate || undefined,
          status: selectedStatus,
          network: 'juvenil',
          pastorInChargeId: pastorInChargeId || undefined,
          pastorInChargeName: pastorInChargeName || undefined,
          notes: notes.trim() || undefined,
        });
      }

      setModalVisible(false);
    } catch (e: any) {
      const msg = e?.message || 'No se pudo guardar el matrimonio.';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    }
  };

  const handleDeleteMarriage = (item: Marriage) => {
    const confirmMessage = `¿Eliminar el registro matrimonial de ${item.husbandName} y ${item.wifeName}?`;

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        deleteMarriage(item.id).catch((e) => console.warn(e));
      }
    } else {
      Alert.alert(
        'Confirmar Eliminación',
        confirmMessage,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => deleteMarriage(item.id).catch((e) => console.warn(e)),
          },
        ]
      );
    }
  };

  return (
    <DoodleBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style="light" />

        {/* CABECERA */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="heart" size={20} color="#FB7185" />
              <Text style={styles.headerTitle}>Matrimonios & Cobertura</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {isPastor
                ? 'Gestión y asignación pastoral de parejas conyugales'
                : 'Cuidado y acompañamiento conyugal de la iglesia'}
            </Text>
          </View>
          {isPastor && (
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleOpenCreate}
              activeOpacity={0.8}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* ========================================================= */}
        {/* VISTA 1: EXCLUSIVA PARA PASTORES (SENIOR & RED)           */}
        {/* ========================================================= */}
        {isPastor ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* STATS DE COBERTURA */}
            <View style={styles.statsRow}>
              <LinearGradient
                colors={['rgba(244, 63, 94, 0.25)', 'rgba(15, 23, 42, 0.75)']}
                style={styles.statCard}>
                <Ionicons name="heart-circle" size={24} color="#FB7185" />
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>Total Parejas</Text>
              </LinearGradient>

              <LinearGradient
                colors={['rgba(16, 185, 129, 0.25)', 'rgba(15, 23, 42, 0.75)']}
                style={styles.statCard}>
                <Ionicons name="shield-checkmark" size={24} color="#10B981" />
                <Text style={styles.statValue}>{stats.active}</Text>
                <Text style={styles.statLabel}>Activos</Text>
              </LinearGradient>

              <LinearGradient
                colors={['rgba(56, 189, 248, 0.25)', 'rgba(15, 23, 42, 0.75)']}
                style={styles.statCard}>
                <Ionicons name="gift" size={24} color="#38BDF8" />
                <Text style={styles.statValue}>{stats.thisMonthAnniversaries}</Text>
                <Text style={styles.statLabel}>Aniversarios Mes</Text>
              </LinearGradient>
            </View>

            {/* AVISO PASTORAL EXCLUSIVO */}
            <View style={styles.pastoralBadgeCard}>
              <Ionicons name="shield-half" size={18} color="#F43F5E" />
              <View style={{ flex: 1 }}>
                <Text style={styles.pastoralBadgeTitle}>Acceso Pastoral Exclusivo</Text>
                <Text style={styles.pastoralBadgeDesc}>
                  Solo los pastores tienen la facultad de enlazar y asignar parejas matrimoniales.
                  Los miembros no pueden auto-asignarse parejas para salvaguardar la cobertura
                  y el orden pastoral.
                </Text>
              </View>
            </View>

            {/* BARRA DE BÚSQUEDA Y FILTROS */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color="#64748B" style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por esposo, esposa o pastor..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* BOTONES DE FILTRO DE COBERTURA */}
            <View style={styles.filterPillsRow}>
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  coverageFilter === 'all' && styles.filterPillActive,
                ]}
                onPress={() => setCoverageFilter('all')}>
                <Text
                  style={[
                    styles.filterPillText,
                    coverageFilter === 'all' && styles.filterPillTextActive,
                  ]}>
                  Todos los Matrimonios
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  coverageFilter === 'mine' && styles.filterPillActive,
                ]}
                onPress={() => setCoverageFilter('mine')}>
                <Ionicons
                  name="shield-checkmark"
                  size={13}
                  color={coverageFilter === 'mine' ? '#FFFFFF' : '#FB7185'}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    coverageFilter === 'mine' && styles.filterPillTextActive,
                  ]}>
                  Bajo Mi Cobertura
                </Text>
              </TouchableOpacity>
            </View>

            {/* LISTA DE MATRIMONIOS */}
            <View style={styles.listSection}>
              {visibleMarriages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="heart-dislike-outline" size={36} color="#64748B" />
                  </View>
                  <Text style={styles.emptyTitle}>No hay matrimonios registrados</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchQuery
                      ? 'No hay resultados con el filtro actual.'
                      : 'Presiona el botón "+" superior para enlazar la primera pareja matrimonial bajo tu cobertura.'}
                  </Text>
                </View>
              ) : (
                visibleMarriages.map((item) => {
                  const years = calculateYearsMarried(item.marriageDate);
                  const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.active;

                  return (
                    <LinearGradient
                      key={item.id}
                      colors={['rgba(30, 41, 59, 0.85)', 'rgba(15, 23, 42, 0.95)']}
                      style={styles.marriageCard}>
                      {/* FILA SUPERIOR: BADGES & ACCIONES */}
                      <View style={styles.cardTopRow}>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: statusConf.bg },
                            ]}>
                            <Text style={[styles.statusBadgeText, { color: statusConf.color }]}>
                              {statusConf.label}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.actionsRow}>
                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => handleOpenEdit(item)}
                            activeOpacity={0.7}>
                            <Ionicons name="pencil" size={16} color="#38BDF8" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionIconBtn}
                            onPress={() => handleDeleteMarriage(item)}
                            activeOpacity={0.7}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* PAREJA (ESPOSO & ESPOSA) */}
                      <View style={styles.coupleContainer}>
                        <View style={styles.spouseBlock}>
                          <View style={[styles.avatarCircle, { backgroundColor: 'rgba(56, 189, 248, 0.2)' }]}>
                            <Ionicons name="man" size={20} color="#38BDF8" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.spouseRoleLabel}>Esposo</Text>
                            <Text style={styles.spouseName} numberOfLines={1}>
                              {item.husbandName}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.heartConnector}>
                          <Ionicons name="heart" size={20} color="#FB7185" />
                          {years !== null && (
                            <Text style={styles.yearsText}>{years} años</Text>
                          )}
                        </View>

                        <View style={styles.spouseBlock}>
                          <View style={[styles.avatarCircle, { backgroundColor: 'rgba(251, 113, 133, 0.2)' }]}>
                            <Ionicons name="woman" size={20} color="#FB7185" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.spouseRoleLabel}>Esposa</Text>
                            <Text style={styles.spouseName} numberOfLines={1}>
                              {item.wifeName}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* DETALLES DE ANIVERSARIO & PASTOR */}
                      <View style={styles.cardDetailsBox}>
                        <View style={styles.detailItemRow}>
                          <Ionicons name="calendar-outline" size={15} color="#94A3B8" />
                          <Text style={styles.detailItemText}>
                            Boda: {formatWeddingDate(item.marriageDate)}
                          </Text>
                        </View>

                        {item.pastorInChargeName && (
                          <View style={styles.detailItemRow}>
                            <Ionicons name="shield-checkmark-outline" size={15} color="#A78BFA" />
                            <Text style={styles.detailItemText}>
                              Cobertura Pastoral: <Text style={{ color: '#E2E8F0', fontWeight: '600' }}>{item.pastorInChargeName}</Text>
                            </Text>
                          </View>
                        )}

                        {item.notes ? (
                          <View style={[styles.detailItemRow, { marginTop: 4 }]}>
                            <Ionicons name="document-text-outline" size={15} color="#64748B" />
                            <Text style={styles.notesText} numberOfLines={2}>
                              {`"${item.notes}"`}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </LinearGradient>
                  );
                })
              )}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.scrollContent}>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="lock-closed" size={36} color="#64748B" />
              </View>
              <Text style={styles.emptyTitle}>Acceso exclusivo para pastores</Text>
              <Text style={styles.emptySubtitle}>
                Los matrimonios solo pueden ser vistos y gestionados por el cuerpo pastoral.
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* MODAL 1: REGISTRAR / EDITAR MATRIMONIO (PASTORES)         */}
        {/* ========================================================= */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="heart" size={22} color="#FB7185" />
                  <Text style={styles.modalTitle}>
                    {editingMarriage ? 'Editar Matrimonio' : 'Asignar Pareja Matrimonial'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: 520 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}>
                {/* SELECTOR DE ESPOSO */}
                <Text style={styles.fieldLabel}>Esposo (Miembro): *</Text>
                <TouchableOpacity
                  style={styles.pickerTriggerBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    setPickerTarget('husband');
                    setPickerSearch('');
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="man" size={20} color="#38BDF8" />
                    <Text
                      style={[
                        styles.pickerTriggerText,
                        !husbandName && { color: '#64748B' },
                      ]}
                      numberOfLines={1}>
                      {husbandName || 'Seleccionar miembro (Esposo)...'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>

                {/* SELECTOR DE ESPOSA */}
                <Text style={styles.fieldLabel}>Esposa (Miembro): *</Text>
                <TouchableOpacity
                  style={styles.pickerTriggerBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    setPickerTarget('wife');
                    setPickerSearch('');
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <Ionicons name="woman" size={20} color="#FB7185" />
                    <Text
                      style={[
                        styles.pickerTriggerText,
                        !wifeName && { color: '#64748B' },
                      ]}
                      numberOfLines={1}>
                      {wifeName || 'Seleccionar miembro (Esposa)...'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>

                {/* FECHA DE MATRIMONIO */}
                <Text style={styles.fieldLabel}>Fecha de Matrimonio / Boda (Opcional):</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="AAAA-MM-DD (ej: 2018-06-15)"
                  placeholderTextColor="#64748B"
                  value={marriageDate}
                  onChangeText={setMarriageDate}
                />

                {/* PASTOR DE COBERTURA */}
                <Text style={styles.fieldLabel}>Pastor de Cobertura:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {pastorsList.map((p) => {
                      const pName = `${p.firstName} ${p.lastName}`.trim();
                      const isSelected = pastorInChargeId === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.pastorSelectPill,
                            isSelected && styles.pastorSelectPillActive,
                          ]}
                          onPress={() => {
                            setPastorInChargeId(p.id);
                            setPastorInChargeName(pName);
                          }}>
                          <Ionicons
                            name="shield-checkmark"
                            size={14}
                            color={isSelected ? '#FFFFFF' : '#A78BFA'}
                          />
                          <Text
                            style={[
                              styles.pastorSelectPillText,
                              isSelected && styles.pastorSelectPillTextActive,
                            ]}>
                            {pName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* ESTADO CONYUGAL */}
                <Text style={styles.fieldLabel}>Estado:</Text>
                <View style={styles.radioRow}>
                  {(['active', 'separated', 'widowed', 'divorced'] as MarriageStatus[]).map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const isSel = selectedStatus === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.radioItem,
                          isSel && { borderColor: cfg.color, backgroundColor: cfg.bg },
                        ]}
                        onPress={() => setSelectedStatus(st)}>
                        <Text
                          style={[
                            styles.radioItemText,
                            isSel && { color: cfg.color, fontWeight: '700' },
                          ]}>
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* NOTAS PASTORALES */}
                <Text style={styles.fieldLabel}>Notas Confidenciales Pastorales:</Text>
                <TextInput
                  style={[styles.textInput, { height: 75, textAlignVertical: 'top' }]}
                  placeholder="Detalles de consejería, aniversario especial, observaciones..."
                  placeholderTextColor="#64748B"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </ScrollView>

              {/* BOTONES ACCIÓN */}
              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveButton}
                  activeOpacity={0.8}
                  onPress={handleSaveMarriage}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>
                    {editingMarriage ? 'Guardar Cambios' : 'Confirmar Matrimonio'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ========================================================= */}
        {/* MODAL 2: SELECTOR DE MIEMBROS (ESPOSO / ESPOSA)           */}
        {/* ========================================================= */}
        <Modal
          visible={pickerTarget !== null}
          animationType="fade"
          transparent
          onRequestClose={() => setPickerTarget(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Seleccionar {pickerTarget === 'husband' ? 'Esposo (Varón)' : 'Esposa (Mujer)'}
                </Text>
                <TouchableOpacity
                  onPress={() => setPickerTarget(null)}
                  style={{ padding: 4 }}>
                  <Ionicons name="close" size={24} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* BUSCADOR DENTRO DEL PICKER */}
              <View style={[styles.searchContainer, { marginHorizontal: 0, marginBottom: 12 }]}>
                <Ionicons name="search" size={16} color="#64748B" style={{ marginLeft: 10 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por nombre o teléfono..."
                  placeholderTextColor="#64748B"
                  value={pickerSearch}
                  onChangeText={setPickerSearch}
                  autoFocus
                />
              </View>

              {/* LISTADO DE CANDIDATOS */}
              <FlatList
                data={pickerFilteredMembers}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const fullName = `${item.firstName} ${item.lastName}`.trim();
                  return (
                    <TouchableOpacity
                      style={styles.memberPickerItem}
                      activeOpacity={0.7}
                      onPress={() => handleSelectMember(item)}>
                      <View
                        style={[
                          styles.avatarCircle,
                          {
                            backgroundColor:
                              item.gender === 'F'
                                ? 'rgba(251, 113, 133, 0.2)'
                                : 'rgba(56, 189, 248, 0.2)',
                            width: 36,
                            height: 36,
                          },
                        ]}>
                        <Ionicons
                          name={item.gender === 'F' ? 'woman' : 'man'}
                          size={18}
                          color={item.gender === 'F' ? '#FB7185' : '#38BDF8'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberPickerName}>{fullName}</Text>
                        <Text style={styles.memberPickerRole}>
                          {item.role} • {item.phone || 'Sin teléfono'}
                        </Text>
                      </View>
                      <Ionicons name="checkmark" size={18} color="#38BDF8" />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>
                      No se encontraron miembros con ese criterio.
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </DoodleBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FB7185',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  // STATS ROW
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '600',
  },

  // BADGE PASTORAL
  pastoralBadgeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  pastoralBadgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FB7185',
    marginBottom: 2,
  },
  pastoralBadgeDesc: {
    fontSize: 11,
    color: '#CBD5E1',
    lineHeight: 16,
  },

  // SEARCH & FILTERS
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 42,
    paddingHorizontal: 10,
    color: '#FFFFFF',
    fontSize: 13,
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterPillActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
    borderColor: '#FB7185',
  },
  filterPillActiveCoverage: {
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderColor: '#A78BFA',
  },
  filterPillText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // LIST & CARDS
  listSection: {
    gap: 12,
  },
  marriageCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // COUPLE
  coupleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 14,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  spouseBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spouseRoleLabel: {
    fontSize: 10,
    color: '#94A3B8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  spouseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
  },
  heartConnector: {
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  yearsText: {
    fontSize: 10,
    color: '#FB7185',
    fontWeight: '600',
  },

  // CARD DETAILS
  cardDetailsBox: {
    marginTop: 10,
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  detailItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailItemText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  notesText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontStyle: 'italic',
    flex: 1,
  },

  // VISTA MIEMBRO REGULAR
  pastoralNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  pastoralNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 3,
  },
  pastoralNoticeText: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  myMarriageHeroCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  myMarriageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  myMarriageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  myMarriageDetailsBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  pastoralBlessingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  pastoralBlessingText: {
    fontSize: 12,
    color: '#FDE68A',
    flex: 1,
    lineHeight: 17,
    fontStyle: 'italic',
  },

  // EMPTY
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },

  // MODAL FORM
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  pickerTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pickerTriggerText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  radioItemActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  radioItemText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  radioItemTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  pastorSelectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pastorSelectPillActive: {
    backgroundColor: 'rgba(167, 139, 250, 0.3)',
    borderColor: '#A78BFA',
  },
  pastorSelectPillText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  pastorSelectPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FB7185',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // PICKER LIST ITEMS
  memberPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  memberPickerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  memberPickerRole: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
});
