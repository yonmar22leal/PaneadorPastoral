import { useChurch } from '@/context/ChurchContext';
import {
  addDaysISO,
  EVENT_TYPE_META,
  formatEventDate,
  ITEM_TYPE_META,
  localId,
  normalizeEventType,
  scheduleEndTime,
} from '@/lib/events';
import {
  EventMinistryAssignment,
  ServiceScheduleItem,
  VolunteerRoster,
} from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DoodleBackground } from '@/components/doodle-background';
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

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    events,
    canManageEvents,
    toggleVolunteerConfirmation,
    saveEvent,
    deleteEvent,
    currentUser,
    ministries,
    members,
    canUserEditEventPart,
    updateEventMinistryData,
  } = useChurch();

  const [tab, setTab] = useState<'schedule' | 'volunteers'>('schedule');

  const event = events.find((e) => e.id === id);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/planner' as any);

  // Permisos de coordinación y autoría
  const { canEditAll, canEditPart, coordinatedMinistries } = useMemo(() => {
    if (!event) return { canEditAll: false, canEditPart: false, coordinatedMinistries: [] };
    return canUserEditEventPart(event.id, currentUser);
  }, [event, currentUser, canUserEditEventPart]);

  const isOwner = useMemo(() => {
    if (!event || !currentUser) return false;
    if (event.createdById && event.createdById === currentUser.id) return true;
    const userFullName = `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase();
    if (event.createdByName && event.createdByName.trim().toLowerCase() === userFullName) return true;
    return false;
  }, [event, currentUser]);

  // Lista de ministerios activos en este evento
  const eventMinistries = useMemo(() => {
    if (!event) return [];
    if (event.ministries && event.ministries.length > 0) {
      return event.ministries;
    }
    return ministries.map((m) => ({
      ministryId: m.id,
      ministryName: m.name,
      coordinatorId: m.coordinatorId,
      coordinatorName: m.coordinatorName,
      coordinatorPhone: m.coordinatorPhone,
    }));
  }, [event, ministries]);

  // Agrupar servidores por Ministerio para visualización clara y profesional
  const groupedVolunteers = useMemo(() => {
    if (!event) return [];
    const groups: {
      ministryId?: string;
      ministryName: string;
      color: string;
      icon: string;
      coordinatorName?: string;
      items: VolunteerRoster[];
      canManageThisGroup: boolean;
      assignment?: EventMinistryAssignment;
    }[] = [];

    eventMinistries.forEach((em) => {
      const minObj = ministries.find((m) => m.id === em.ministryId);
      const vols = event.volunteers.filter(
        (v) =>
          (v.ministryId && v.ministryId === em.ministryId) ||
          (!v.ministryId && v.area.toLowerCase().includes(em.ministryName.toLowerCase()))
      );
      const isMyCoord =
        canEditAll ||
        (currentUser &&
          (em.coordinatorId === currentUser.id ||
            minObj?.coordinatorId === currentUser.id ||
            (em.coordinatorName && em.coordinatorName.toLowerCase().includes(currentUser.firstName.toLowerCase())) ||
            (minObj?.coordinatorName && minObj?.coordinatorName.toLowerCase().includes(currentUser.firstName.toLowerCase()))));

      groups.push({
        ministryId: em.ministryId,
        ministryName: em.ministryName,
        color: minObj?.color || '#2563EB',
        icon: minObj?.icon || 'people',
        coordinatorName: em.coordinatorName || minObj?.coordinatorName,
        items: vols,
        canManageThisGroup: Boolean(isMyCoord),
        assignment: em,
      });
    });

    const otherVols = event.volunteers.filter((v) => {
      return !eventMinistries.some(
        (em) =>
          (v.ministryId && v.ministryId === em.ministryId) ||
          (!v.ministryId && v.area.toLowerCase().includes(em.ministryName.toLowerCase()))
      );
    });

    if (otherVols.length > 0) {
      groups.push({
        ministryName: 'Otros Servidores / Áreas',
        color: '#64748B',
        icon: 'people-outline',
        items: otherVols,
        canManageThisGroup: canEditAll,
      });
    }

    return groups;
  }, [event, eventMinistries, ministries, canEditAll, currentUser]);

  // Estado para el Modal de Coordinación de Ministerio
  const [activeCoordMinistry, setActiveCoordMinistry] =
    useState<EventMinistryAssignment | null>(null);

  const activeMinObj = useMemo(() => {
    if (!activeCoordMinistry) return null;
    return ministries.find((m) => m.id === activeCoordMinistry.ministryId);
  }, [activeCoordMinistry, ministries]);

  const suggestedRolesForCoord = useMemo(() => {
    return activeMinObj?.defaultRoles || [];
  }, [activeMinObj]);

  const [coordTab, setCoordTab] = useState<'volunteers' | 'schedule' | 'notes'>('volunteers');
  const [modalVolunteers, setModalVolunteers] = useState<VolunteerRoster[]>([]);
  const [modalSchedule, setModalSchedule] = useState<ServiceScheduleItem[]>([]);
  const [modalNotes, setModalNotes] = useState('');
  const [savingCoord, setSavingCoord] = useState(false);

  // Picker de Miembros dentro del Modal de Coordinación
  const [volunteerPickerVisible, setVolunteerPickerVisible] = useState(false);
  const [currentEditingVolId, setCurrentEditingVolId] = useState<string | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showOtherNetworks, setShowOtherNetworks] = useState(false);

  // Red de la actividad (predeterminada)
  const targetNetwork = useMemo<'adulta' | 'juvenil'>(() => {
    if (event?.network && event.network !== 'general') {
      return event.network as 'adulta' | 'juvenil';
    }
    return (currentUser?.network as 'adulta' | 'juvenil') || 'adulta';
  }, [event, currentUser]);

  const targetNetworkCount = useMemo(() => {
    return members.filter((m) => m.network === targetNetwork).length;
  }, [members, targetNetwork]);

  const otherNetworkCount = useMemo(() => {
    return members.filter((m) => m.network !== targetNetwork).length;
  }, [members, targetNetwork]);

  const filteredMembersList = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    return members.filter((m) => {
      // 1. Por defecto solo la red actual, a menos que se active ver apoyo
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
  }, [members, memberSearchQuery, showOtherNetworks, targetNetwork]);

  if (!event) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="calendar-clear-outline" size={42} color="#93C5FD" />
        <Text style={{ color: '#FFFFFF', fontWeight: '800', marginTop: 10 }}>
          Evento no encontrado
        </Text>
        <TouchableOpacity onPress={goBack} style={{ marginTop: 14 }}>
          <Text style={{ color: '#93C5FD', fontWeight: '700' }}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const meta = EVENT_TYPE_META[normalizeEventType(event.type)];
  const end = scheduleEndTime(event);
  const confirmed = event.volunteers.filter((v) => v.confirmed).length;
  const totalMinutes = event.schedule.reduce(
    (a, it) => a + (Number(it.durationMinutes) || 0),
    0
  );

  const handleDuplicate = async () => {
    const { id: _omit, createdAt: _c, updatedAt: _u, ...rest } = event;
    const newId = await saveEvent({
      ...rest,
      date: addDaysISO(event.date, 7),
      schedule: event.schedule.map((s) => ({ ...s, id: localId('sch') })),
      volunteers: event.volunteers.map((v) => ({ ...v, id: localId('vol'), confirmed: false })),
      createdById: undefined,
      createdByName: undefined,
    });
    router.replace(`/planner/editor?id=${newId}` as any);
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined'
          ? window.confirm(`¿Seguro que deseas eliminar “${event.title}”?`)
          : true;
      if (confirmed) {
        deleteEvent(event.id).then(() => goBack());
      }
      return;
    }

    Alert.alert('Eliminar evento', `¿Seguro que deseas eliminar “${event.title}”?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(event.id);
          goBack();
        },
      },
    ]);
  };

  // Abrir Modal de Coordinación para un ministerio
  const openMinistryCoordinator = (assignment: EventMinistryAssignment) => {
    setActiveCoordMinistry(assignment);
    setCoordTab('volunteers');

    // Cargar voluntarios de este ministerio
    const minVols = event.volunteers.filter(
      (v) =>
        v.ministryId === assignment.ministryId ||
        v.area.toLowerCase() === assignment.ministryName.toLowerCase()
    );
    setModalVolunteers(minVols);

    // Cargar bloques de cronograma de este ministerio
    const minSch = event.schedule.filter(
      (s) =>
        s.ministryId === assignment.ministryId ||
        s.ministryName?.toLowerCase() === assignment.ministryName.toLowerCase() ||
        s.title.toLowerCase().includes(assignment.ministryName.toLowerCase())
    );
    setModalSchedule(minSch);
    setModalNotes(assignment.notes || '');
  };

  // Guardar cambios del ministerio coordinado
  const handleSaveCoordinatorChanges = async () => {
    if (!activeCoordMinistry) return;
    setSavingCoord(true);
    try {
      await updateEventMinistryData(
        event.id,
        activeCoordMinistry.ministryId,
        modalSchedule,
        modalVolunteers,
        modalNotes
      );
      setActiveCoordMinistry(null);
      Alert.alert(
        '¡Cambios Guardados!',
        `Se han actualizado los servidores y bloques correspondientes a ${activeCoordMinistry.ministryName}.`
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudieron guardar los cambios.');
    } finally {
      setSavingCoord(false);
    }
  };

  // Helpers para modificar voluntarios en modal de coordinación
  const addModalVolunteer = (suggestedRole?: string) => {
    if (!activeCoordMinistry) return;
    const newId = localId('vol');
    const newVol: VolunteerRoster = {
      id: newId,
      area: activeCoordMinistry.ministryName,
      ministryId: activeCoordMinistry.ministryId,
      role: suggestedRole || '',
      assignedTo: '',
      confirmed: false,
    };
    setModalVolunteers((prev) => [...prev, newVol]);
    if (suggestedRole) {
      setCurrentEditingVolId(newId);
      setMemberSearchQuery('');
      setVolunteerPickerVisible(true);
    }
  };

  const updateModalVolunteer = (volId: string, patch: Partial<VolunteerRoster>) => {
    setModalVolunteers((prev) =>
      prev.map((v) => (v.id === volId ? { ...v, ...patch } : v))
    );
  };

  const removeModalVolunteer = (volId: string) => {
    setModalVolunteers((prev) => prev.filter((v) => v.id !== volId));
  };

  // Helpers para modificar cronograma en modal de coordinación
  const addModalScheduleItem = () => {
    if (!activeCoordMinistry) return;
    const newItem: ServiceScheduleItem = {
      id: localId('sch'),
      order: event.schedule.length + modalSchedule.length + 1,
      time: event.time,
      durationMinutes: 15,
      title: `${activeCoordMinistry.ministryName}`,
      responsible: '',
      type:
        activeCoordMinistry.ministryName.toLowerCase().includes('alabanza')
          ? 'worship'
          : 'other',
      ministryId: activeCoordMinistry.ministryId,
      ministryName: activeCoordMinistry.ministryName,
    };
    setModalSchedule((prev) => [...prev, newItem]);
  };

  const updateModalScheduleItem = (itemId: string, patch: Partial<ServiceScheduleItem>) => {
    setModalSchedule((prev) =>
      prev.map((s) => (s.id === itemId ? { ...s, ...patch } : s))
    );
  };

  const removeModalScheduleItem = (itemId: string) => {
    setModalSchedule((prev) => prev.filter((s) => s.id !== itemId));
  };

  // Permiso para confirmar un voluntario específico
  const canConfirmVolunteer = (vol: VolunteerRoster) => {
    // 1. Dueño del evento o Pastor Principal
    if (canEditAll) return true;
    if (!currentUser) return false;
    // 2. Es el propio voluntario
    const userFullName = `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase();
    const isSelf =
      (vol.memberId && vol.memberId === currentUser.id) ||
      (vol.assignedMemberId && vol.assignedMemberId === currentUser.id) ||
      (vol.assignedTo && vol.assignedTo.trim().toLowerCase() === userFullName);
    if (isSelf) return true;
    // 3. Coordinador de ese ministerio
    return coordinatedMinistries.some(
      (m) =>
        m.ministryId === vol.ministryId ||
        m.ministryName.toLowerCase() === vol.area.toLowerCase()
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <DoodleBackground style={{ backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130, backgroundColor: 'transparent' }}>
        {/* HERO */}
        <View style={[styles.hero, { backgroundColor: '#1E3A8A' }]}>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.iconBtn} onPress={goBack}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            {canEditAll && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.iconBtn} onPress={handleDuplicate}>
                  <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, styles.iconBtnDanger]}
                  onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={[styles.typePill, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={12} color="#FFFFFF" />
            <Text style={styles.typePillText}>{meta.label}</Text>
          </View>
          <Text style={styles.title}>{event.title}</Text>
          {event.theme ? <Text style={styles.theme}>“{event.theme}”</Text> : null}

          {/* INSIGNIA DEL DUEÑO / CREADOR */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              alignSelf: 'flex-start',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 20,
            }}>
            <Ionicons name="shield-checkmark" size={13} color="#93C5FD" />
            <Text style={{ fontSize: 11, color: '#DBEAFE' }}>
              Creado por:{' '}
              <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>
                {event.createdByName || 'Pastor'}
              </Text>
              {isOwner
                ? ' · (Tú eres el dueño)'
                : currentUser?.role === 'senior_pastor'
                ? ' · (Supervisión Pastoral)'
                : ''}
            </Text>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar" size={14} color="#93C5FD" />
              <Text style={styles.infoText}>{formatEventDate(event.date)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time" size={14} color="#93C5FD" />
              <Text style={styles.infoText}>
                {event.time}
                {end ? ` – ${end}` : ''}
              </Text>
            </View>
            {event.location ? (
              <View style={styles.infoItem}>
                <Ionicons name="location" size={14} color="#93C5FD" />
                <Text style={styles.infoText}>{event.location}</Text>
              </View>
            ) : null}
          </View>

          {(event.preacher || event.worshipLeader) && (
            <View style={styles.peopleRow}>
              {event.preacher ? (
                <View style={styles.personBox}>
                  <Text style={styles.personRole}>Predica</Text>
                  <Text style={styles.personName}>{event.preacher}</Text>
                </View>
              ) : null}
              {event.worshipLeader ? (
                <View style={styles.personBox}>
                  <Text style={styles.personRole}>Alabanza</Text>
                  <Text style={styles.personName}>{event.worshipLeader}</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* EQUIPO DE COORDINADORES DELEGADOS */}
          {eventMinistries.length > 0 && (
            <View style={styles.ministriesHeroCard}>
              <Text style={styles.ministriesHeroTitle}>COORDINACIÓN DE MINISTERIOS</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginTop: 8 }}>
                {eventMinistries.map((min) => {
                  const isMyMin = coordinatedMinistries.some(
                    (cm) => cm.ministryId === min.ministryId
                  );
                  return (
                    <TouchableOpacity
                      key={min.ministryId}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (canEditAll || isMyMin) {
                          openMinistryCoordinator(min);
                        }
                      }}
                      style={[
                        styles.minHeroChip,
                        isMyMin && styles.minHeroChipActive,
                      ]}>
                      <View style={styles.minHeroChipDot} />
                      <View>
                        <Text style={styles.minHeroChipName}>{min.ministryName}</Text>
                        <Text style={styles.minHeroChipCoord}>
                          {min.coordinatorName} {isMyMin ? '(Tú)' : ''}
                        </Text>
                      </View>
                      {(canEditAll || isMyMin) && (
                        <Ionicons name="create-outline" size={14} color="#DBEAFE" style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* BANNER PARA COORDINADOR ASIGNADO */}
        {!canEditAll && coordinatedMinistries.length > 0 && (
          <View style={styles.coordCalloutCard}>
            <View style={styles.coordCalloutIcon}>
              <Ionicons name="sparkles" size={22} color="#1E3A8A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.coordCalloutTitle}>¡Eres Coordinador Asignado!</Text>
              <Text style={styles.coordCalloutDesc}>
                Tienes a cargo:{' '}
                <Text style={{ fontWeight: '800' }}>
                  {coordinatedMinistries.map((m) => m.ministryName).join(', ')}
                </Text>
                . Puedes armar la lista de servidores y editar tu parte del cronograma.
              </Text>
              <TouchableOpacity
                style={styles.coordCalloutBtn}
                onPress={() => openMinistryCoordinator(coordinatedMinistries[0])}>
                <Ionicons name="create" size={16} color="#FFFFFF" />
                <Text style={styles.coordCalloutBtnText}>
                  Gestionar {coordinatedMinistries[0].ministryName}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {event.description ? (
          <View style={styles.descCard}>
            <Ionicons name="information-circle" size={16} color="#2563EB" />
            <Text style={styles.descText}>{event.description}</Text>
          </View>
        ) : null}

        {!canManageEvents && !canEditPart && (
          <View style={styles.readOnlyNotice}>
            <Ionicons name="eye-outline" size={14} color="#64748B" />
            <Text style={styles.readOnlyText}>
              Modo consulta · Los pastores y coordinadores administran este cronograma
            </Text>
          </View>
        )}

        {/* TABS */}
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'schedule' && styles.segmentBtnActive]}
            onPress={() => setTab('schedule')}>
            <Ionicons
              name="list"
              size={16}
              color={tab === 'schedule' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentText,
                tab === 'schedule' && styles.segmentTextActive,
              ]}>
              Cronograma ({event.schedule.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, tab === 'volunteers' && styles.segmentBtnActive]}
            onPress={() => setTab('volunteers')}>
            <Ionicons
              name="people"
              size={16}
              color={tab === 'volunteers' ? '#FFFFFF' : '#64748B'}
            />
            <Text
              style={[
                styles.segmentText,
                tab === 'volunteers' && styles.segmentTextActive,
              ]}>
              Servidores ({confirmed}/{event.volunteers.length})
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'schedule' ? (
          <View style={styles.section}>
            {event.schedule.length > 0 && (
              <Text style={styles.sectionHint}>Duración total: {totalMinutes} minutos</Text>
            )}
            {event.schedule.length === 0 ? (
              <Text style={styles.emptyText}>Aún no se ha cargado el cronograma.</Text>
            ) : (
              event.schedule.map((item, index) => {
                const im = ITEM_TYPE_META[item.type] ?? ITEM_TYPE_META.other;
                const isLast = index === event.schedule.length - 1;

                return (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <Text style={styles.timeText}>{item.time}</Text>
                      <Text style={styles.durationPill}>{item.durationMinutes} min</Text>
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>
                    <View style={[styles.itemCard, { borderLeftColor: im.color }]}>
                      <View style={styles.itemHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          {item.ministryName ? (
                            <View style={styles.minTag}>
                              <Text style={styles.minTagText}>🏛️ {item.ministryName}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={[styles.itemBadge, { backgroundColor: im.color }]}>
                          <Ionicons
                            name={im.icon as keyof typeof Ionicons.glyphMap}
                            size={10}
                            color="#FFFFFF"
                          />
                          <Text style={styles.itemBadgeText}>{im.label}</Text>
                        </View>
                      </View>

                      {item.responsible ? (
                        <View style={styles.responsibleRow}>
                          <Ionicons name="person-circle" size={16} color="#64748B" />
                          <Text style={styles.responsibleText}>{item.responsible}</Text>
                        </View>
                      ) : null}
                      {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionHint}>
              Toca un servidor para marcarlo como confirmado o pendiente.
            </Text>

            {groupedVolunteers.length === 0 ? (
              <Text style={styles.emptyText}>No hay servidores asignados para este servicio.</Text>
            ) : (
              groupedVolunteers.map((grp) => (
                <View
                  key={grp.ministryName}
                  style={[styles.minGroupCard, { borderLeftColor: grp.color }]}>
                  {/* Cabecera del Ministerio */}
                  <View style={styles.minGroupHeader}>
                    <View
                      style={[
                        styles.minGroupIcon,
                        { backgroundColor: grp.color + '1A' },
                      ]}>
                      <Ionicons
                        name={(grp.icon as any) || 'people'}
                        size={18}
                        color={grp.color}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.minGroupTitle}>{grp.ministryName}</Text>
                      {grp.coordinatorName ? (
                        <Text style={styles.minGroupCoord}>
                          Coord. Permanente:{' '}
                          <Text style={{ fontWeight: '700', color: '#1E293B' }}>
                            {grp.coordinatorName}
                          </Text>
                        </Text>
                      ) : null}
                    </View>
                    {grp.canManageThisGroup && grp.assignment && (
                      <TouchableOpacity
                        style={[styles.manageMinBtn, { borderColor: grp.color }]}
                        onPress={() => openMinistryCoordinator(grp.assignment!)}>
                        <Ionicons name="create-outline" size={13} color={grp.color} />
                        <Text style={[styles.manageMinBtnText, { color: grp.color }]}>
                          Asignar Roles
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Lista de Servidores del Ministerio */}
                  {grp.items.length === 0 ? (
                    <View style={styles.minGroupEmpty}>
                      <Text style={styles.minGroupEmptyText}>
                        Aún no se han asignado servidores para {grp.ministryName}.
                      </Text>
                      {grp.canManageThisGroup && grp.assignment && (
                        <TouchableOpacity
                          style={[styles.addFirstServerBtn, { backgroundColor: grp.color }]}
                          onPress={() => openMinistryCoordinator(grp.assignment!)}>
                          <Ionicons name="person-add" size={13} color="#FFFFFF" />
                          <Text style={styles.addFirstServerBtnText}>
                            Asignar Puestos & Servidores
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    grp.items.map((vol) => {
                      const allowedToToggle = canConfirmVolunteer(vol);
                      return (
                        <TouchableOpacity
                          key={vol.id}
                          disabled={!allowedToToggle}
                          activeOpacity={0.8}
                          onPress={() => toggleVolunteerConfirmation(event.id, vol.id)}
                          style={[
                            styles.volCard,
                            vol.confirmed && styles.volCardConfirmed,
                          ]}>
                          <View
                            style={[
                              styles.checkbox,
                              vol.confirmed && styles.checkboxActive,
                            ]}>
                            {vol.confirmed && (
                              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                flexWrap: 'wrap',
                              }}>
                              <View
                                style={[
                                  styles.roleBadgePill,
                                  {
                                    backgroundColor: grp.color + '18',
                                    borderColor: grp.color + '55',
                                  },
                                ]}>
                                <Text
                                  style={[
                                    styles.roleBadgePillText,
                                    { color: grp.color },
                                  ]}>
                                  {vol.role || 'Servidor'}
                                </Text>
                              </View>
                              {vol.phone ? (
                                <Text style={{ fontSize: 11, color: '#64748B' }}>
                                  📞 {vol.phone}
                                </Text>
                              ) : null}
                            </View>
                            <Text style={styles.volName}>{vol.assignedTo}</Text>
                          </View>
                          <Text
                            style={[
                              styles.volStatus,
                              vol.confirmed
                                ? { backgroundColor: '#DCFCE7', color: '#065F46' }
                                : { backgroundColor: '#FEF3C7', color: '#B45309' },
                            ]}>
                            {vol.confirmed ? 'Confirmado' : 'Pendiente'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      </DoodleBackground>

      {/* FAB FLOTANTE PARA EDITAR */}
      {canEditAll ? (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.9}
          onPress={() => router.push(`/planner/editor?id=${event.id}` as any)}>
          <Ionicons name="create" size={20} color="#FFFFFF" />
          <Text style={styles.fabText}>Editar evento completo</Text>
        </TouchableOpacity>
      ) : coordinatedMinistries.length > 0 ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: '#7C3AED' }]}
          activeOpacity={0.9}
          onPress={() => openMinistryCoordinator(coordinatedMinistries[0])}>
          <Ionicons name="sparkles" size={20} color="#FFFFFF" />
          <Text style={styles.fabText}>
            Gestionar {coordinatedMinistries[0].ministryName}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* ===================================================================== */}
      {/* MODAL DE TRABAJO: COORDINACIÓN DE UN MINISTERIO ESPECÍFICO */}
      {/* ===================================================================== */}
      <Modal
        visible={Boolean(activeCoordMinistry)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setActiveCoordMinistry(null)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setActiveCoordMinistry(null)}
              style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.modalSubHeader}>COORDINACIÓN DEL SERVICIO</Text>
              <Text style={styles.modalTitle}>
                {activeCoordMinistry?.ministryName || 'Ministerio'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalSaveBtn, savingCoord && { opacity: 0.6 }]}
              disabled={savingCoord}
              onPress={handleSaveCoordinatorChanges}>
              <Text style={styles.modalSaveBtnText}>Guardar</Text>
            </TouchableOpacity>
          </View>

          {/* Sub-tabs del Modal de Coordinador */}
          <View style={styles.coordSubSegment}>
            <TouchableOpacity
              style={[
                styles.coordSubSegmentBtn,
                coordTab === 'volunteers' && styles.coordSubSegmentBtnActive,
              ]}
              onPress={() => setCoordTab('volunteers')}>
              <Ionicons
                name="people"
                size={14}
                color={coordTab === 'volunteers' ? '#FFFFFF' : '#64748B'}
              />
              <Text
                style={[
                  styles.coordSubSegmentText,
                  coordTab === 'volunteers' && styles.coordSubSegmentTextActive,
                ]}>
                Servidores ({modalVolunteers.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.coordSubSegmentBtn,
                coordTab === 'schedule' && styles.coordSubSegmentBtnActive,
              ]}
              onPress={() => setCoordTab('schedule')}>
              <Ionicons
                name="list"
                size={14}
                color={coordTab === 'schedule' ? '#FFFFFF' : '#64748B'}
              />
              <Text
                style={[
                  styles.coordSubSegmentText,
                  coordTab === 'schedule' && styles.coordSubSegmentTextActive,
                ]}>
                Cronograma ({modalSchedule.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.coordSubSegmentBtn,
                coordTab === 'notes' && styles.coordSubSegmentBtnActive,
              ]}
              onPress={() => setCoordTab('notes')}>
              <Ionicons
                name="chatbox-ellipses"
                size={14}
                color={coordTab === 'notes' ? '#FFFFFF' : '#64748B'}
              />
              <Text
                style={[
                  styles.coordSubSegmentText,
                  coordTab === 'notes' && styles.coordSubSegmentTextActive,
                ]}>
                Indicaciones
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {/* 1. SERVIDORES DEL MINISTERIO */}
            {coordTab === 'volunteers' && (
              <View>
                <View style={styles.tabSectionHeader}>
                  <Text style={styles.tabSectionTitle}>
                    Servidores de {activeCoordMinistry?.ministryName}
                  </Text>
                  <Text style={styles.tabSectionSub}>
                    Asigna a los hermanos en cada puesto (ej: Consola, Videos, Foto, Puerta, Pilar derecho...).
                  </Text>
                </View>

                {/* Barra de puestos rápidos para asignar con 1 toque */}
                {suggestedRolesForCoord.length > 0 && (
                  <View style={styles.quickRolesBox}>
                    <Text style={styles.quickRolesTitle}>
                      Puestos Rápidos · Toca para asignar:
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.quickRolesScroll}>
                      {suggestedRolesForCoord.map((roleName, rIdx) => (
                        <TouchableOpacity
                          key={rIdx}
                          style={styles.quickRolePill}
                          onPress={() => addModalVolunteer(roleName)}>
                          <Ionicons name="add-circle" size={14} color="#2563EB" />
                          <Text style={styles.quickRolePillText}>{roleName}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {modalVolunteers.length === 0 ? (
                  <View style={styles.emptyCardSm}>
                    <Ionicons name="people-outline" size={32} color="#94A3B8" />
                    <Text style={styles.emptyCardSmText}>
                      No has agregado servidores para {activeCoordMinistry?.ministryName}. Toca un puesto arriba o el botón inferior.
                    </Text>
                  </View>
                ) : (
                  modalVolunteers.map((vol) => (
                    <View key={vol.id} style={styles.volEditCard}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.volEditCardLabel}>Puesto / Rol Asignado</Text>

                        {/* Chips seleccionables para cambiar el rol con 1 toque */}
                        {suggestedRolesForCoord.length > 0 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                            {suggestedRolesForCoord.map((r, rIdx) => {
                              const isSelected = vol.role === r;
                              return (
                                <TouchableOpacity
                                  key={rIdx}
                                  onPress={() => updateModalVolunteer(vol.id, { role: r })}
                                  style={[
                                    styles.volRoleChip,
                                    isSelected && styles.volRoleChipActive,
                                  ]}>
                                  <Text
                                    style={[
                                      styles.volRoleChipText,
                                      isSelected && styles.volRoleChipTextActive,
                                    ]}>
                                    {r}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        )}

                        <TextInput
                          style={styles.inputSm}
                          value={vol.role}
                          onChangeText={(t) => updateModalVolunteer(vol.id, { role: t })}
                          placeholder="Puesto (ej: Consola, Videos, Foto, Puerta, Pilar derecho)"
                          placeholderTextColor="#94A3B8"
                        />

                        <Text style={[styles.volEditCardLabel, { marginTop: 4 }]}>
                          Servidor / Miembro
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <TextInput
                            style={[styles.inputSm, { flex: 1 }]}
                            value={vol.assignedTo}
                            onChangeText={(t) => updateModalVolunteer(vol.id, { assignedTo: t })}
                            placeholder="Nombre del servidor"
                            placeholderTextColor="#94A3B8"
                          />
                          <TouchableOpacity
                            style={styles.pickMemberSmBtn}
                            onPress={() => {
                              setCurrentEditingVolId(vol.id);
                              setMemberSearchQuery('');
                              setVolunteerPickerVisible(true);
                            }}>
                            <Ionicons name="people" size={14} color="#2563EB" />
                            <Text style={styles.pickMemberSmBtnText}>Buscar</Text>
                          </TouchableOpacity>
                        </View>
                        <TextInput
                          style={styles.inputSm}
                          value={vol.phone || ''}
                          keyboardType="phone-pad"
                          onChangeText={(t) => updateModalVolunteer(vol.id, { phone: t })}
                          placeholder="Teléfono / WhatsApp (opcional)"
                          placeholderTextColor="#94A3B8"
                        />

                        {/* Toggle de confirmación */}
                        <TouchableOpacity
                          style={styles.confirmToggleBtn}
                          onPress={() =>
                            updateModalVolunteer(vol.id, { confirmed: !vol.confirmed })
                          }>
                          <Ionicons
                            name={vol.confirmed ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={vol.confirmed ? '#059669' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.confirmToggleText,
                              vol.confirmed && { color: '#059669', fontWeight: '800' },
                            ]}>
                            {vol.confirmed ? 'Servidor Confirmado' : 'Pendiente por confirmar'}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.volRemoveBtn}
                        onPress={() => removeModalVolunteer(vol.id)}>
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <TouchableOpacity style={styles.addBtnModal} onPress={() => addModalVolunteer()}>
                  <Ionicons name="person-add" size={16} color="#2563EB" />
                  <Text style={styles.addBtnModalText}>
                    Agregar Otro Servidor a {activeCoordMinistry?.ministryName}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 2. CRONOGRAMA DEL MINISTERIO */}
            {coordTab === 'schedule' && (
              <View>
                <View style={styles.tabSectionHeader}>
                  <Text style={styles.tabSectionTitle}>
                    Cronograma de {activeCoordMinistry?.ministryName}
                  </Text>
                  <Text style={styles.tabSectionSub}>
                    Configura los bloques, alabanzas o momentos dirigidos por tu ministerio.
                  </Text>
                </View>

                {modalSchedule.length === 0 ? (
                  <View style={styles.emptyCardSm}>
                    <Ionicons name="list-outline" size={32} color="#94A3B8" />
                    <Text style={styles.emptyCardSmText}>
                      No hay bloques específicos asignados a este ministerio.
                    </Text>
                  </View>
                ) : (
                  modalSchedule.map((item) => (
                    <View key={item.id} style={styles.schEditCard}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.schCardLabel}>Título del bloque *</Text>
                        <TextInput
                          style={styles.inputSm}
                          value={item.title}
                          onChangeText={(t) => updateModalScheduleItem(item.id, { title: t })}
                          placeholder="Ej: Alabanza & Adoración, Bienvenida a visitas"
                          placeholderTextColor="#94A3B8"
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.schCardLabel}>Quién dirige / Responsable</Text>
                            <TextInput
                              style={styles.inputSm}
                              value={item.responsible}
                              onChangeText={(t) =>
                                updateModalScheduleItem(item.id, { responsible: t })
                              }
                              placeholder="Ej: Voz profética, Ujier principal"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                          <View style={{ width: 100 }}>
                            <Text style={styles.schCardLabel}>Duración (min)</Text>
                            <TextInput
                              style={styles.inputSm}
                              keyboardType="number-pad"
                              value={String(item.durationMinutes)}
                              onChangeText={(t) =>
                                updateModalScheduleItem(item.id, {
                                  durationMinutes: parseInt(t.replace(/[^0-9]/g, ''), 10) || 0,
                                })
                              }
                            />
                          </View>
                        </View>
                        <Text style={styles.schCardLabel}>
                          Canciones / Notas Técnicas / Repertorio
                        </Text>
                        <TextInput
                          style={[styles.inputSm, { height: 60, textAlignVertical: 'top' }]}
                          multiline
                          value={item.notes || ''}
                          onChangeText={(t) =>
                            updateModalScheduleItem(item.id, { notes: t || undefined })
                          }
                          placeholder="Escribe la lista de canciones, tonalidad, o señales para multimedia..."
                          placeholderTextColor="#94A3B8"
                        />
                      </View>

                      <TouchableOpacity
                        style={styles.volRemoveBtn}
                        onPress={() => removeModalScheduleItem(item.id)}>
                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}

                <TouchableOpacity style={styles.addBtnModal} onPress={addModalScheduleItem}>
                  <Ionicons name="add-circle" size={16} color="#2563EB" />
                  <Text style={styles.addBtnModalText}>
                    Agregar bloque para {activeCoordMinistry?.ministryName}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 3. INDICACIONES / NOTAS */}
            {coordTab === 'notes' && (
              <View>
                <View style={styles.tabSectionHeader}>
                  <Text style={styles.tabSectionTitle}>Indicaciones de Coordinación</Text>
                  <Text style={styles.tabSectionSub}>
                    Notas generales sobre uniformidad, hora de llegada o directrices del pastor.
                  </Text>
                </View>

                <TextInput
                  style={[styles.inputSm, { height: 120, textAlignVertical: 'top' }]}
                  multiline
                  value={modalNotes}
                  onChangeText={setModalNotes}
                  placeholder="Ej: Todos los servidores deben llegar a las 8:15 AM para la oración y prueba de sonido. Vestimenta: azul y blanco."
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MODAL SELECCIONAR MIEMBRO PARA VOLUNTARIO */}
      <Modal
        visible={volunteerPickerVisible}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setVolunteerPickerVisible(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setVolunteerPickerVisible(false)}
              style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Buscar en Directorio</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Buscar por nombre o teléfono..."
              placeholderTextColor="#94A3B8"
              value={memberSearchQuery}
              onChangeText={setMemberSearchQuery}
            />
            {memberSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setMemberSearchQuery('')}>
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

          {/* INDICADOR EXPLICATIVO */}
          <View style={styles.networkNoticeBox}>
            <Ionicons
              name={showOtherNetworks ? 'hand-left' : 'shield-checkmark'}
              size={13}
              color={showOtherNetworks ? '#7C3AED' : '#2563EB'}
            />
            <Text style={styles.networkNoticeText}>
              {showOtherNetworks
                ? 'Mostrando todos los miembros. Los servidores de otra red tienen etiqueta de Apoyo.'
                : `Predeterminado: Solo miembros de la ${targetNetwork === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}.`}
            </Text>
          </View>

          <FlatList
            data={filteredMembersList}
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
                  onPress={() => {
                    if (currentEditingVolId) {
                      updateModalVolunteer(currentEditingVolId, {
                        assignedTo: `${item.firstName} ${item.lastName}`,
                        phone: item.phone || '',
                        assignedMemberId: item.id,
                      });
                    }
                    setVolunteerPickerVisible(false);
                  }}>
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
                  <Ionicons
                    name="add-circle"
                    size={22}
                    color={isSupport ? '#7C3AED' : '#2563EB'}
                  />
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
  safeArea: { flex: 1, backgroundColor: '#1E3A8A' },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDanger: { backgroundColor: 'rgba(239,68,68,0.2)' },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginTop: 8, letterSpacing: -0.4 },
  theme: { color: '#DBEAFE', fontSize: 14, fontStyle: 'italic', marginTop: 4 },
  infoGrid: { marginTop: 14, gap: 6 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  peopleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  personBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 10,
  },
  personRole: { color: '#93C5FD', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  personName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginTop: 2 },
  ministriesHeroCard: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  ministriesHeroTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#93C5FD',
    letterSpacing: 0.8,
  },
  minHeroChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  minHeroChipActive: {
    backgroundColor: 'rgba(124,58,237,0.3)',
    borderColor: '#C4B5FD',
  },
  minHeroChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  minHeroChipName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  minHeroChipCoord: {
    color: '#BFDBFE',
    fontSize: 10,
  },
  coordCalloutCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    gap: 12,
    alignItems: 'flex-start',
  },
  coordCalloutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordCalloutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  coordCalloutDesc: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 2,
    lineHeight: 17,
  },
  coordCalloutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 8,
    gap: 6,
  },
  coordCalloutBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  descCard: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
  },
  descText: { flex: 1, color: '#1E3A8A', fontSize: 13, lineHeight: 18 },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 12,
  },
  readOnlyText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentBtnActive: { backgroundColor: '#1E3A8A' },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  segmentTextActive: { color: '#FFFFFF' },
  section: { paddingHorizontal: 16, marginTop: 14 },
  sectionHint: { fontSize: 12, color: '#64748B', marginBottom: 10, fontWeight: '600' },
  emptyText: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginVertical: 20 },
  timelineRow: { flexDirection: 'row', marginBottom: 10 },
  timelineLeft: { width: 70, alignItems: 'center' },
  timeText: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  durationPill: {
    fontSize: 10,
    color: '#64748B',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 2,
    fontWeight: '600',
  },
  timelineLine: { flex: 1, width: 2, backgroundColor: '#CBD5E1', marginTop: 4 },
  itemCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 4,
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 },
  itemTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  minTag: {
    backgroundColor: '#EDE9FE',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  minTagText: { fontSize: 10, fontWeight: '700', color: '#6D28D9' },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  itemBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  responsibleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  responsibleText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  itemNotes: { fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 4 },
  volCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  volCardConfirmed: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  volArea: { fontSize: 11, fontWeight: '800', color: '#2563EB', textTransform: 'uppercase' },
  volName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  volRole: { fontSize: 12, color: '#64748B' },
  volStatus: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  // MODAL STYLES
  modalSafeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalCloseBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  modalSubHeader: { fontSize: 9, fontWeight: '800', color: '#2563EB', letterSpacing: 0.8 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  modalSaveBtn: { backgroundColor: '#1E3A8A', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  modalSaveBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  coordSubSegment: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  coordSubSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
  },
  coordSubSegmentBtnActive: { backgroundColor: '#1E3A8A' },
  coordSubSegmentText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  coordSubSegmentTextActive: { color: '#FFFFFF' },
  modalScroll: { padding: 16, paddingBottom: 60 },
  tabSectionHeader: { marginBottom: 12 },
  tabSectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  tabSectionSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  emptyCardSm: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 10,
  },
  emptyCardSmText: { fontSize: 13, color: '#64748B', marginTop: 8, textAlign: 'center' },
  volEditCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    gap: 8,
  },
  schEditCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    gap: 8,
  },
  schCardLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 2 },
  inputSm: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#0F172A',
  },
  pickMemberSmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 4,
    height: 36,
  },
  pickMemberSmBtnText: { color: '#2563EB', fontSize: 12, fontWeight: '700' },
  confirmToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  confirmToggleText: { fontSize: 12, color: '#64748B' },
  volRemoveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtnModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
    gap: 6,
  },
  addBtnModalText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },
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
  searchBarInput: { flex: 1, fontSize: 14, color: '#0F172A' },
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
  memberAvatarText: { fontSize: 13, fontWeight: '800', color: '#475569' },
  memberName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  memberRole: { fontSize: 11, color: '#64748B', marginTop: 1 },
  memberPhone: { fontSize: 11, color: '#2563EB', marginTop: 2, fontWeight: '600' },
  minGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  minGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  minGroupIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minGroupTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  minGroupCoord: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  manageMinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  manageMinBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  minGroupEmpty: {
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
  },
  minGroupEmptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  addFirstServerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addFirstServerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  roleBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleBadgePillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  quickRolesBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  quickRolesTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickRolesScroll: {
    gap: 6,
  },
  quickRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickRolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E40AF',
  },
  volEditCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  volRoleChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  volRoleChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  volRoleChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  volRoleChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  networkSelectorBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
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
  networkNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  networkNoticeText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
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
