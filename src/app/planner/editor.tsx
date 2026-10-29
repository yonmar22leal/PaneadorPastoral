import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DoodleBackground } from '@/components/doodle-background';
import { useChurch } from '@/context/ChurchContext';
import {
  ChurchEvent,
  ChurchEventType,
  ChurchServiceSlotId,
  EventMinistryAssignment,
  Member,
  Ministry,
  ServiceScheduleItem,
  VolunteerRoster,
} from '@/types/church';
import {
  addDaysISO,
  buildTemplate,
  EVENT_TYPE_META,
  EVENT_TYPES,
  formatEventDate,
  fromISODate,
  ITEM_TYPE_META,
  ITEM_TYPES,
  localId,
  nextWeekdayISO,
  normalizeEventType,
  parseTime,
  recalcScheduleTimes,
  scheduleEndTime,
  todayISO,
} from '@/lib/events';

const NETWORK_OPTIONS: { id: ChurchEvent['network']; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'adulta', label: 'Red Adulta' },
  { id: 'juvenil', label: 'Red Juvenil' },
];

export default function EventEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; type?: string; date?: string }>();
  const {
    events,
    saveEvent,
    canUserEditFullEvent,
    getUserCoordinatedMinistries,
    servicesSchedule,
    currentUser,
    ministries,
    members,
  } = useChurch();

  const existing = params.id ? events.find((e) => e.id === params.id) : undefined;
  const sundayServices = servicesSchedule.filter((s) => s.day === 'Domingo');

  const initialType: ChurchEventType =
    (existing?.type ? normalizeEventType(existing.type) : undefined) ??
    (params.type ? normalizeEventType(params.type) : 'servicio');

  const defaultSlot =
    sundayServices.find((s) => s.network === currentUser?.network) ?? sundayServices[0];
  const initialTime =
    existing?.time ??
    (initialType === 'servicio' && defaultSlot
      ? defaultSlot.time.split(' - ')[0]
      : '7:00 PM');

  const [type, setType] = useState<ChurchEventType>(initialType);
  const [serviceSlotId, setServiceSlotId] = useState<ChurchServiceSlotId | undefined>(
    existing?.serviceSlotId ?? (initialType === 'servicio' ? defaultSlot?.id : undefined)
  );
  const [title, setTitle] = useState(
    existing?.title ??
      (initialType === 'servicio'
        ? defaultSlot?.name ?? 'Servicio Dominical'
        : '')
  );
  const [date, setDate] = useState(
    existing?.date ?? params.date ?? (initialType === 'servicio' ? nextWeekdayISO(0) : todayISO())
  );
  const [time, setTime] = useState(initialTime);
  const [location, setLocation] = useState(existing?.location ?? 'Templo Principal');
  const [network, setNetwork] = useState<ChurchEvent['network']>(
    existing?.network ??
      (initialType === 'servicio' && defaultSlot ? defaultSlot.network : 'general')
  );
  const [theme, setTheme] = useState(existing?.theme ?? '');
  const [preacher, setPreacher] = useState(existing?.preacher ?? '');
  const [worshipLeader, setWorshipLeader] = useState(existing?.worshipLeader ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [schedule, setSchedule] = useState<ServiceScheduleItem[]>(
    existing?.schedule ?? buildTemplate(initialType, initialTime)
  );
  const [volunteers, setVolunteers] = useState<VolunteerRoster[]>(existing?.volunteers ?? []);

  const [eventMinistries, setEventMinistries] = useState<EventMinistryAssignment[]>(() => {
    if (existing?.ministries && existing.ministries.length > 0) {
      return existing.ministries;
    }
    return ministries.map((m) => ({
      ministryId: m.id,
      ministryName: m.name,
      coordinatorId: m.coordinatorId,
      coordinatorName: m.coordinatorName,
      coordinatorPhone: m.coordinatorPhone,
      notes: '',
    }));
  });

  const [pickingCoordinatorForMinId, setPickingCoordinatorForMinId] = useState<string | null>(null);
  const [pickingVolunteerForVolId, setPickingVolunteerForVolId] = useState<string | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showOtherNetworks, setShowOtherNetworks] = useState(false);

  // Red de la actividad en edición (predeterminada)
  const targetNetwork = useMemo<'adulta' | 'juvenil'>(() => {
    if (network && network !== 'general') {
      return network as 'adulta' | 'juvenil';
    }
    return (currentUser?.network as 'adulta' | 'juvenil') || 'adulta';
  }, [network, currentUser]);

  const targetNetworkCount = useMemo(() => {
    return members.filter((m) => m.network === targetNetwork).length;
  }, [members, targetNetwork]);

  const otherNetworkCount = useMemo(() => {
    return members.filter((m) => m.network !== targetNetwork).length;
  }, [members, targetNetwork]);

  const filteredMembersList = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase();
    return members.filter((m) => {
      // 1. Predeterminado: solo miembros de la red actual a menos que se active ver apoyo
      if (!showOtherNetworks && m.network !== targetNetwork) {
        return false;
      }
      if (!q) return true;
      return (
        m.firstName.toLowerCase().includes(q) ||
        m.lastName.toLowerCase().includes(q) ||
        (m.phone ? m.phone.includes(q) : false)
      );
    });
  }, [members, memberSearchQuery, showOtherNetworks, targetNetwork]);

  const toggleMinistry = (min: Ministry) => {
    setEventMinistries((prev) => {
      const exists = prev.some((m) => m.ministryId === min.id);
      if (exists) {
        return prev.filter((m) => m.ministryId !== min.id);
      }
      return [
        ...prev,
        {
          ministryId: min.id,
          ministryName: min.name,
          coordinatorId: min.coordinatorId,
          coordinatorName: min.coordinatorName,
          coordinatorPhone: min.coordinatorPhone,
          notes: '',
        },
      ];
    });
  };

  const updateMinistryCoordinator = (ministryId: string, member: Member) => {
    setEventMinistries((prev) =>
      prev.map((m) =>
        m.ministryId === ministryId
          ? {
              ...m,
              coordinatorId: member.id,
              coordinatorName: `${member.firstName} ${member.lastName}`,
              coordinatorPhone: member.phone || '',
            }
          : m
      )
    );
    setPickingCoordinatorForMinId(null);
  };

  const updateMinistryNotes = (ministryId: string, notes: string) => {
    setEventMinistries((prev) =>
      prev.map((m) => (m.ministryId === ministryId ? { ...m, notes } : m))
    );
  };

  const [autoTimes, setAutoTimes] = useState(true);
  const [scheduleTouched, setScheduleTouched] = useState(!!existing);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const finalSchedule = useMemo(
    () =>
      autoTimes
        ? recalcScheduleTimes(time, schedule)
        : schedule.map((s, i) => ({ ...s, order: i + 1 })),
    [autoTimes, time, schedule]
  );
  const totalMinutes = finalSchedule.reduce((a, it) => a + (Number(it.durationMinutes) || 0), 0);
  const endTime = scheduleEndTime({ time, schedule: finalSchedule });

  const dateOptions = useMemo(() => {
    const base = todayISO();
    const list = Array.from({ length: 35 }, (_, i) => addDaysISO(base, i));
    if (!list.includes(date)) list.unshift(date);
    return list;
  }, [date]);

  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace('/planner' as any);

  // VALIDACIÓN DE SEGURIDAD ESTRICTA:
  // 1. Si el evento ya existe: solo el creador (dueño) o Pastores Principales pueden editarlo.
  if (existing) {
    if (!canUserEditFullEvent(existing, currentUser)) {
      const coordinated = getUserCoordinatedMinistries(existing.id, currentUser);
      const isCoordinator = coordinated.length > 0;
      return (
        <SafeAreaView style={[styles.safeArea, styles.center, { paddingHorizontal: 28 }]}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}>
            <Ionicons name="shield-outline" size={38} color="#EF4444" />
          </View>
          <Text style={[styles.lockedTitle, { fontSize: 20, textAlign: 'center' }]}>
            Acceso Restringido
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: '#475569',
              textAlign: 'center',
              marginTop: 6,
              lineHeight: 20,
            }}>
            El creador del evento es el dueño:{'\n'}
            <Text style={{ fontWeight: '800', color: '#0F172A' }}>
              {existing.createdByName || 'Otro pastor'}
            </Text>
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: '#64748B',
              textAlign: 'center',
              marginTop: 10,
              lineHeight: 18,
            }}>
            {isCoordinator
              ? `Como coordinador de ${coordinated.map((c) => c.ministryName).join(', ')}, tienes permisos para asignar servidores y coordinar tu bloque desde la vista del evento.`
              : 'Solo el creador del evento y los Pastores Principales tienen autorización para modificar los datos generales de este evento.'}
          </Text>

          {isCoordinator && (
            <TouchableOpacity
              style={{
                backgroundColor: '#7C3AED',
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderRadius: 14,
                marginTop: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
              onPress={() => router.replace(`/planner/${existing.id}` as any)}>
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                Ir a Coordinar mi Área
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={goBack}
            style={{
              marginTop: isCoordinator ? 12 : 20,
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 12,
              backgroundColor: '#F1F5F9',
            }}>
            <Text style={{ color: '#334155', fontWeight: '700' }}>Volver al Planificador</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
  } else {
    // 2. Si es un nuevo evento: solo pastores pueden crearlo
    if (!canUserEditFullEvent(null, currentUser)) {
      return (
        <SafeAreaView style={[styles.safeArea, styles.center, { paddingHorizontal: 28 }]}>
          <Ionicons name="lock-closed" size={44} color="#93C5FD" />
          <Text style={[styles.lockedTitle, { marginTop: 12 }]}>
            Solo los pastores pueden crear nuevos eventos
          </Text>
          <TouchableOpacity onPress={goBack} style={{ marginTop: 14 }}>
            <Text style={{ color: '#93C5FD', fontWeight: '700' }}>Volver</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
  }

  // ---- handlers ----
  const handleTypeChange = (t: ChurchEventType) => {
    setType(t);
    const prevDefaultTitle =
      title === EVENT_TYPE_META[type]?.label ||
      sundayServices.some((s) => s.name === title) ||
      title === 'Servicio Dominical' ||
      !title.trim();
    if (t === 'servicio') {
      const slot = sundayServices.find((s) => s.id === serviceSlotId) ?? defaultSlot;
      setServiceSlotId(slot?.id);
      if (slot) {
        setTime(slot.time.split(' - ')[0]);
        setNetwork(slot.network);
        if (prevDefaultTitle) setTitle(slot.name);
      } else if (prevDefaultTitle) {
        setTitle('Servicio');
      }
      if (fromISODate(date).getDay() !== 0) setDate(nextWeekdayISO(0));
    } else {
      setServiceSlotId(undefined);
      if (prevDefaultTitle) setTitle('');
    }
    if (!scheduleTouched) {
      const startTime =
        t === 'servicio' && defaultSlot ? defaultSlot.time.split(' - ')[0] : time;
      setSchedule(buildTemplate(t, startTime));
    }
  };

  const handleSlotChange = (slotId: ChurchServiceSlotId) => {
    const slot = sundayServices.find((s) => s.id === slotId);
    if (!slot) return;
    const wasDefaultTitle = sundayServices.some((s) => s.name === title) || !title.trim();
    setServiceSlotId(slotId);
    setTime(slot.time.split(' - ')[0]);
    setNetwork(slot.network);
    if (wasDefaultTitle) setTitle(slot.name);
  };

  const updateItem = (id: string, patch: Partial<ServiceScheduleItem>) => {
    setScheduleTouched(true);
    setSchedule((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    setScheduleTouched(true);
    setSchedule((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeItem = (id: string) => {
    setScheduleTouched(true);
    setSchedule((prev) => prev.filter((it) => it.id !== id));
  };

  const addItem = () => {
    const newItem: ServiceScheduleItem = {
      id: localId('sch'),
      order: schedule.length + 1,
      time: endTime ?? time,
      durationMinutes: 10,
      title: '',
      responsible: '',
      type: 'other',
    };
    setScheduleTouched(true);
    setSchedule((prev) => [...prev, newItem]);
    setExpandedId(newItem.id);
  };

  const loadTemplate = () => {
    const apply = () => {
      setSchedule(buildTemplate(type, time));
      setScheduleTouched(true);
      setExpandedId(null);
    };
    if (schedule.length === 0) return apply();
    Alert.alert('Cargar plantilla', 'Esto reemplazará el cronograma actual. ¿Continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reemplazar', style: 'destructive', onPress: apply },
    ]);
  };

  const updateVolunteer = (id: string, patch: Partial<VolunteerRoster>) =>
    setVolunteers((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Falta el nombre', 'Escribe el nombre del evento.');
      return;
    }
    if (parseTime(time) === undefined) {
      Alert.alert('Hora inválida', 'Escribe la hora de inicio, por ejemplo: 9:00 AM o 19:30.');
      return;
    }
    const untitled = finalSchedule.filter((s) => !s.title.trim());
    if (untitled.length > 0) {
      Alert.alert('Bloques sin nombre', 'Hay bloques del cronograma sin título. Complétalos o elimínalos.');
      return;
    }
    setSaving(true);
    try {
      const id = await saveEvent({
        id: existing?.id,
        type,
        title: title.trim(),
        date,
        time: time.trim(),
        location: location.trim() || undefined,
        network,
        serviceSlotId: type === 'servicio' ? serviceSlotId : undefined,
        theme: theme.trim() || undefined,
        preacher: preacher.trim() || undefined,
        worshipLeader: worshipLeader.trim() || undefined,
        description: description.trim() || undefined,
        schedule: finalSchedule,
        volunteers: volunteers.filter((v) => v.assignedTo.trim() || v.area.trim()),
        ministries: eventMinistries,
        createdById: existing?.createdById,
        createdByName: existing?.createdByName,
      });
      if (existing) goBack();
      else router.replace(`/planner/${id}` as any);
    } finally {
      setSaving(false);
    }
  };

  const typeMeta = EVENT_TYPE_META[type];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={goBack}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{existing ? 'Editar evento' : 'Nuevo evento'}</Text>
        <TouchableOpacity
          style={[styles.saveBtnTop, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}>
          <Text style={styles.saveBtnTopText}>Guardar</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#080C16' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <DoodleBackground>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* BANNER DE AUTORÍA Y PROPIEDAD */}
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 14,
              marginBottom: 4,
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              borderRadius: 14,
              padding: 12,
              borderWidth: 1,
              borderColor: 'rgba(56, 189, 248, 0.25)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: 'rgba(56, 189, 248, 0.18)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="shield-checkmark" size={18} color="#38BDF8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#38BDF8', textTransform: 'uppercase' }}>
                {existing ? 'Dueño del Evento' : 'Creador del Evento'}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                {existing?.createdByName || (currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Pastor')}
              </Text>
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>
                {currentUser?.role === 'senior_pastor' && existing && existing.createdById !== currentUser.id
                  ? 'Editando con autoridad de Pastor Principal'
                  : 'Solo el creador y pastores principales pueden editar este evento'}
              </Text>
            </View>
          </View>

          {/* 1. TYPE */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Tipo</Text>
            <View style={styles.typeGrid}>
              {EVENT_TYPES.map((t) => {
                const m = EVENT_TYPE_META[t];
                const active = t === type;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => handleTypeChange(t)}
                    style={[
                      styles.typeChip,
                      active && { backgroundColor: m.color, borderColor: m.color },
                    ]}>
                    <Ionicons
                      name={m.icon as keyof typeof Ionicons.glyphMap}
                      size={14}
                      color={active ? '#FFFFFF' : m.color}
                    />
                    <Text style={[styles.typeChipText, active && { color: '#FFFFFF' }]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {type === 'servicio' && sundayServices.length > 0 && (
              <>
                <Text style={[styles.label, { marginTop: 14 }]}>
                  Vincular a horario dominical (opcional)
                </Text>
                <View style={styles.typeGrid}>
                  {sundayServices.map((s) => {
                    const active = s.id === serviceSlotId;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => handleSlotChange(s.id)}
                        style={[styles.slotChip, active && styles.slotChipActive]}>
                        <Text style={[styles.slotChipTitle, active && { color: '#FFFFFF' }]}>
                          {s.name}
                        </Text>
                        <Text style={[styles.slotChipSub, active && { color: '#BFDBFE' }]}>
                          {s.time.split(' - ')[0]}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* 2. WHEN & WHERE */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fecha y hora</Text>
            <Text style={styles.dateSelected}>
              <Ionicons name="calendar" size={14} color={typeMeta.color} /> {formatEventDate(date)}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
              {dateOptions.map((d) => {
                const dt = fromISODate(d);
                const active = d === date;
                const isSunday = dt.getDay() === 0;
                return (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDate(d)}
                    style={[
                      styles.dayChip,
                      isSunday && styles.dayChipSunday,
                      active && { backgroundColor: typeMeta.color, borderColor: typeMeta.color },
                    ]}>
                    <Text
                      style={[
                        styles.dayChipWeek,
                        isSunday && { color: '#2563EB' },
                        active && { color: '#FFFFFF' },
                      ]}>
                      {formatEventDate(d, { short: true }).split(' ')[0]}
                    </Text>
                    <Text style={[styles.dayChipNum, active && { color: '#FFFFFF' }]}>
                      {dt.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Hora de inicio</Text>
                <TextInput
                  style={styles.input}
                  value={time}
                  onChangeText={setTime}
                  placeholder="9:00 AM"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Text style={styles.label}>Lugar</Text>
                <TextInput
                  style={styles.input}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Templo Principal"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Dirigido a</Text>
            <View style={styles.typeGrid}>
              {NETWORK_OPTIONS.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => setNetwork(n.id)}
                  style={[styles.netChip, network === n.id && styles.netChipActive]}>
                  <Text style={[styles.netChipText, network === n.id && { color: '#FFFFFF' }]}>
                    {n.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 3. DETAILS */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Detalles</Text>
            <Text style={styles.label}>Nombre del evento *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ej: Encuentro de Mujeres"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.label}>Tema / Lema</Text>
            <TextInput
              style={styles.input}
              value={theme}
              onChangeText={setTheme}
              placeholder="Ej: Mujeres de Fe y Propósito"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Predica</Text>
                <TextInput
                  style={styles.input}
                  value={preacher}
                  onChangeText={setPreacher}
                  placeholder="Pastor(a)..."
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Alabanza</Text>
                <TextInput
                  style={styles.input}
                  value={worshipLeader}
                  onChangeText={setWorshipLeader}
                  placeholder="Equipo..."
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>
            <Text style={styles.label}>Indicaciones generales</Text>
            <TextInput
              style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholder="Notas para el equipo (vestimenta, llegada, etc.)"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* 3.1. MINISTERIOS & COORDINACIÓN */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Ministerios & Coordinación</Text>
                <Text style={styles.cardSub}>
                  Asigna al coordinador responsable de Alabanza, Audiovisual y Protocolo para este servicio.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.templateBtn}
                onPress={() => router.push('/ministries' as any)}>
                <Ionicons name="ribbon-outline" size={14} color="#38BDF8" />
                <Text style={styles.templateBtnText}>Ministerios</Text>
              </TouchableOpacity>
            </View>

            {ministries.map((min) => {
              const assignment = eventMinistries.find((m) => m.ministryId === min.id);
              const isActive = Boolean(assignment);

              return (
                <View
                  key={min.id}
                  style={[
                    styles.minCardRow,
                    isActive && { borderColor: min.color || '#38BDF8', backgroundColor: (min.color || '#38BDF8') + '15' },
                  ]}>
                  <View style={styles.minHeaderRow}>
                    <View
                      style={[
                        styles.minIconCircle,
                        { backgroundColor: (min.color || '#38BDF8') + '22' },
                      ]}>
                      <Ionicons
                        name={(min.icon as any) || 'people'}
                        size={18}
                        color={min.color || '#38BDF8'}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.minTitle}>{min.name}</Text>
                      <Text style={styles.minSub} numberOfLines={1}>
                        {min.description || 'Sin descripción'}
                      </Text>
                    </View>
                    <Switch
                      value={isActive}
                      onValueChange={() => toggleMinistry(min)}
                      trackColor={{ false: '#334155', true: min.color || '#0284C7' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {isActive && assignment && (
                    <View style={styles.minAssignmentDetails}>
                      <View style={styles.minCoordBox}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.minCoordLabel}>COORDINADOR(A) PERMANENTE</Text>
                          <Text style={styles.minCoordName}>{assignment.coordinatorName}</Text>
                          {assignment.coordinatorPhone ? (
                            <Text style={styles.minCoordPhone}>📞 {assignment.coordinatorPhone}</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={styles.minChangeBtn}
                          onPress={() => {
                            setMemberSearchQuery('');
                            setPickingCoordinatorForMinId(min.id);
                          }}>
                          <Ionicons name="swap-horizontal" size={14} color="#38BDF8" />
                          <Text style={styles.minChangeBtnText}>Delegar</Text>
                        </TouchableOpacity>
                      </View>

                      {min.defaultRoles && min.defaultRoles.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={[styles.label, { fontSize: 10, color: '#94A3B8' }]}>
                            PUESTOS DISPONIBLES:
                          </Text>
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {min.defaultRoles.map((r, rIdx) => (
                              <View
                                key={rIdx}
                                style={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.12)',
                                  borderRadius: 6,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                }}>
                                <Text style={{ fontSize: 10, color: '#E2E8F0', fontWeight: '700' }}>
                                  {r}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      <Text style={[styles.label, { marginTop: 8, fontSize: 11 }]}>
                        Instrucciones para {assignment.coordinatorName.split(' ')[0]}
                      </Text>
                      <TextInput
                        style={[styles.input, styles.inputSm]}
                        placeholder={`Ej: Vestimenta formal, llegar 45 min antes...`}
                        placeholderTextColor="#94A3B8"
                        value={assignment.notes || ''}
                        onChangeText={(t) => updateMinistryNotes(min.id, t)}
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* 4. SCHEDULE */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Cronograma</Text>
                <Text style={styles.cardSub}>
                  {finalSchedule.length} bloques · {totalMinutes} min
                  {endTime ? ` · termina ${endTime}` : ''}
                </Text>
              </View>
              <TouchableOpacity style={styles.templateBtn} onPress={loadTemplate}>
                <Ionicons name="color-wand" size={14} color="#38BDF8" />
                <Text style={styles.templateBtnText}>Plantilla</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.autoRow}>
              <Ionicons name="timer-outline" size={16} color="#475569" />
              <Text style={styles.autoText}>Calcular horas según la duración</Text>
              <Switch
                value={autoTimes}
                onValueChange={setAutoTimes}
                trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {finalSchedule.map((item, index) => {
              const im = ITEM_TYPE_META[item.type] ?? ITEM_TYPE_META.other;
              const expanded = expandedId === item.id;
              return (
                <View key={item.id} style={[styles.itemCard, { borderLeftColor: im.color }]}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.itemSummary}
                    onPress={() => setExpandedId(expanded ? null : item.id)}>
                    <View style={styles.itemTimeBox}>
                      <Text style={styles.itemTime}>{item.time || '--'}</Text>
                      <Text style={styles.itemDur}>{item.durationMinutes}m</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle} numberOfLines={1}>
                        {item.title || 'Bloque sin título'}
                      </Text>
                      <Text style={styles.itemResp} numberOfLines={1}>
                        {im.label}
                        {item.responsible ? ` · ${item.responsible}` : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'create-outline'}
                      size={18}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.itemEditor}>
                      <Text style={styles.label}>Título *</Text>
                      <TextInput
                        style={styles.input}
                        value={item.title}
                        onChangeText={(v) => updateItem(item.id, { title: v })}
                        placeholder="Ej: Alabanza & Adoración"
                        placeholderTextColor="#94A3B8"
                        autoFocus={!item.title}
                      />
                      <Text style={styles.label}>Responsable</Text>
                      <TextInput
                        style={styles.input}
                        value={item.responsible}
                        onChangeText={(v) => updateItem(item.id, { responsible: v })}
                        placeholder="¿Quién lo dirige?"
                        placeholderTextColor="#94A3B8"
                      />
                      <View style={styles.row2}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Duración (min)</Text>
                          <View style={styles.stepper}>
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() =>
                                updateItem(item.id, {
                                  durationMinutes: Math.max(0, item.durationMinutes - 5),
                                })
                              }>
                              <Ionicons name="remove" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                            <TextInput
                              style={styles.stepInput}
                              keyboardType="number-pad"
                              value={String(item.durationMinutes)}
                              onChangeText={(v) =>
                                updateItem(item.id, {
                                  durationMinutes: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
                                })
                              }
                            />
                            <TouchableOpacity
                              style={styles.stepBtn}
                              onPress={() =>
                                updateItem(item.id, { durationMinutes: item.durationMinutes + 5 })
                              }>
                              <Ionicons name="add" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.label}>Hora</Text>
                          <TextInput
                            style={[styles.input, autoTimes && styles.inputDisabled]}
                            editable={!autoTimes}
                            value={item.time}
                            onChangeText={(v) => updateItem(item.id, { time: v })}
                            placeholder="9:00 AM"
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                      </View>
                      <Text style={styles.label}>Tipo de bloque</Text>
                      <View style={styles.typeGrid}>
                        {ITEM_TYPES.map((it) => {
                          const m = ITEM_TYPE_META[it];
                          const active = it === item.type;
                          return (
                            <TouchableOpacity
                              key={it}
                              onPress={() => updateItem(item.id, { type: it })}
                              style={[
                                styles.miniChip,
                                active && { backgroundColor: m.color, borderColor: m.color },
                              ]}>
                              <Text style={[styles.miniChipText, active && { color: '#FFFFFF' }]}>
                                {m.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={styles.label}>Ministerio asignado</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                        <TouchableOpacity
                          onPress={() => updateItem(item.id, { ministryId: undefined, ministryName: undefined })}
                          style={[
                            styles.miniChip,
                            !item.ministryName && { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.25)' },
                          ]}>
                          <Text style={[styles.miniChipText, !item.ministryName && { color: '#FFFFFF' }]}>
                            General
                          </Text>
                        </TouchableOpacity>
                        {eventMinistries.map((m) => {
                          const isSel = item.ministryId === m.ministryId || item.ministryName === m.ministryName;
                          return (
                            <TouchableOpacity
                              key={m.ministryId}
                              onPress={() =>
                                updateItem(item.id, {
                                  ministryId: m.ministryId,
                                  ministryName: m.ministryName,
                                })
                              }
                              style={[
                                styles.miniChip,
                                isSel && { backgroundColor: '#0284C7', borderColor: '#38BDF8' },
                              ]}>
                              <Text style={[styles.miniChipText, isSel && { color: '#FFFFFF' }]}>
                                {m.ministryName}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      <Text style={styles.label}>Notas</Text>
                      <TextInput
                        style={styles.input}
                        value={item.notes ?? ''}
                        onChangeText={(v) => updateItem(item.id, { notes: v || undefined })}
                        placeholder="Indicaciones para este bloque"
                        placeholderTextColor="#94A3B8"
                      />
                      <View style={styles.itemActions}>
                        <TouchableOpacity
                          style={styles.itemActionBtn}
                          disabled={index === 0}
                          onPress={() => moveItem(index, -1)}>
                          <Ionicons name="arrow-up" size={16} color={index === 0 ? 'rgba(255,255,255,0.15)' : '#94A3B8'} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.itemActionBtn}
                          disabled={index === finalSchedule.length - 1}
                          onPress={() => moveItem(index, 1)}>
                          <Ionicons
                            name="arrow-down"
                            size={16}
                            color={index === finalSchedule.length - 1 ? 'rgba(255,255,255,0.15)' : '#94A3B8'}
                          />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity
                          style={[styles.itemActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
                          onPress={() => removeItem(item.id)}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          <Text style={styles.deleteText}>Quitar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            <TouchableOpacity style={styles.addBtn} onPress={addItem}>
              <Ionicons name="add-circle" size={18} color="#38BDF8" />
              <Text style={styles.addBtnText}>Agregar bloque al cronograma</Text>
            </TouchableOpacity>
          </View>

          {/* 5. VOLUNTEERS */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Servidores</Text>
            <Text style={styles.cardSub}>Equipo asignado para este evento</Text>
            {volunteers.map((v) => (
              <View key={v.id} style={styles.volRow}>
                <View style={{ flex: 1, gap: 6 }}>
                  {eventMinistries.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {eventMinistries.map((em) => (
                        <TouchableOpacity
                          key={em.ministryId}
                          onPress={() => updateVolunteer(v.id, { area: em.ministryName, ministryId: em.ministryId })}
                          style={[
                            styles.miniChip,
                            v.area === em.ministryName && { backgroundColor: '#0284C7', borderColor: '#38BDF8' },
                          ]}>
                          <Text style={[styles.miniChipText, v.area === em.ministryName && { color: '#FFFFFF' }]}>
                            {em.ministryName}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Chips de Puestos / Roles sugeridos para esta área/ministerio */}
                  {(() => {
                    const minObj = ministries.find(
                      (m) =>
                        (v.ministryId && m.id === v.ministryId) ||
                        m.name.toLowerCase() === v.area.toLowerCase()
                    );
                    if (!minObj || !minObj.defaultRoles || minObj.defaultRoles.length === 0) return null;
                    return (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                        {minObj.defaultRoles.map((r, rIdx) => {
                          const isSel = v.role === r;
                          return (
                            <TouchableOpacity
                              key={rIdx}
                              onPress={() => updateVolunteer(v.id, { role: r })}
                              style={[
                                styles.miniChip,
                                isSel && {
                                  backgroundColor: minObj.color || '#0284C7',
                                  borderColor: minObj.color || '#38BDF8',
                                },
                              ]}>
                              <Text
                                style={[
                                  styles.miniChipText,
                                  isSel && { color: '#FFFFFF', fontWeight: '800' },
                                ]}>
                                {r}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    );
                  })()}

                  <View style={styles.row2}>
                    <TextInput
                      style={[styles.input, styles.inputSm, { flex: 1 }]}
                      value={v.area}
                      onChangeText={(t) => updateVolunteer(v.id, { area: t })}
                      placeholder="Área (ej: Ujieres, Alabanza)"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={[styles.input, styles.inputSm, { flex: 1 }]}
                      value={v.role}
                      onChangeText={(t) => updateVolunteer(v.id, { role: t })}
                      placeholder="Puesto / Rol (ej: Consola, Puerta)"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.input, styles.inputSm, { flex: 1 }]}
                      value={v.assignedTo}
                      onChangeText={(t) => updateVolunteer(v.id, { assignedTo: t })}
                      placeholder="Nombre del servidor"
                      placeholderTextColor="#94A3B8"
                    />
                    <TouchableOpacity
                      style={styles.pickMemberSmBtn}
                      onPress={() => {
                        setMemberSearchQuery('');
                        setPickingVolunteerForVolId(v.id);
                      }}>
                      <Ionicons name="people" size={14} color="#38BDF8" />
                      <Text style={styles.pickMemberSmBtnText}>Buscar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.volRemove}
                  onPress={() => setVolunteers((prev) => prev.filter((x) => x.id !== v.id))}>
                  <Ionicons name="close" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() =>
                setVolunteers((prev) => [
                  ...prev,
                  { id: localId('vol'), area: '', role: '', assignedTo: '', confirmed: false },
                ])
              }>
              <Ionicons name="person-add" size={16} color="#38BDF8" />
              <Text style={styles.addBtnText}>Agregar servidor</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        </DoodleBackground>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: typeMeta.color }, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.9}>
          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>
            {existing ? 'Guardar cambios' : `Crear ${typeMeta.label}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL DELEGAR COORDINADOR DE MINISTERIO */}
      <Modal
        visible={Boolean(pickingCoordinatorForMinId)}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setPickingCoordinatorForMinId(null)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPickingCoordinatorForMinId(null)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Delegar Coordinador</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Buscar por nombre..."
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
                color={!showOtherNetworks ? '#FFFFFF' : '#38BDF8'}
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
                color={showOtherNetworks ? '#FFFFFF' : '#A78BFA'}
              />
              <Text
                style={[
                  styles.networkTabText,
                  showOtherNetworks && styles.networkTabTextActive,
                  !showOtherNetworks && { color: '#C4B5FD' },
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
                    !showOtherNetworks && { color: '#C4B5FD' },
                  ]}>
                  +{otherNetworkCount}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {currentUser && (
            <TouchableOpacity
              style={styles.myselfQuickRow}
              onPress={() => {
                if (pickingCoordinatorForMinId) {
                  updateMinistryCoordinator(pickingCoordinatorForMinId, currentUser as unknown as Member);
                }
              }}>
              <View style={styles.myselfAvatar}>
                <Ionicons name="star" size={16} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.myselfTitle}>
                  {currentUser.firstName} {currentUser.lastName} (Tú mismo)
                </Text>
                <Text style={styles.myselfSubtitle}>Asignarme como coordinador de este servicio</Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color="#38BDF8" />
            </TouchableOpacity>
          )}

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
                    if (pickingCoordinatorForMinId) {
                      updateMinistryCoordinator(pickingCoordinatorForMinId, item);
                    }
                  }}>
                  <View
                    style={[
                      styles.memberAvatar,
                      isSupport && { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
                    ]}>
                    <Text
                      style={[
                        styles.memberAvatarText,
                        isSupport && { color: '#C4B5FD' },
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
                  <Ionicons name="checkmark-circle-outline" size={20} color={isSupport ? '#A78BFA' : '#38BDF8'} />
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>

      {/* MODAL ELEGIR VOLUNTARIO DE LA IGLESIA */}
      <Modal
        visible={Boolean(pickingVolunteerForVolId)}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={() => setPickingVolunteerForVolId(null)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPickingVolunteerForVolId(null)} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Seleccionar Servidor</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchBarWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Buscar en directorio de miembros..."
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
                color={!showOtherNetworks ? '#FFFFFF' : '#38BDF8'}
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
                color={showOtherNetworks ? '#FFFFFF' : '#A78BFA'}
              />
              <Text
                style={[
                  styles.networkTabText,
                  showOtherNetworks && styles.networkTabTextActive,
                  !showOtherNetworks && { color: '#C4B5FD' },
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
                    !showOtherNetworks && { color: '#C4B5FD' },
                  ]}>
                  +{otherNetworkCount}
                </Text>
              </View>
            </TouchableOpacity>
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
                    if (pickingVolunteerForVolId) {
                      updateVolunteer(pickingVolunteerForVolId, {
                        assignedTo: `${item.firstName} ${item.lastName}`,
                        phone: item.phone || '',
                        assignedMemberId: item.id,
                      });
                      setPickingVolunteerForVolId(null);
                    }
                  }}>
                  <View
                    style={[
                      styles.memberAvatar,
                      isSupport && { backgroundColor: 'rgba(124, 58, 237, 0.2)' },
                    ]}>
                    <Text
                      style={[
                        styles.memberAvatarText,
                        isSupport && { color: '#C4B5FD' },
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
                  <Ionicons name="add-circle" size={22} color={isSupport ? '#A78BFA' : '#38BDF8'} />
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
  safeArea: { flex: 1, backgroundColor: '#070A14' },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  lockedTitle: { color: '#FFFFFF', fontWeight: '800', marginTop: 12, fontSize: 15, textAlign: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  saveBtnTop: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnTopText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  cardSub: { fontSize: 12, color: '#94A3B8', fontWeight: '600', marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginTop: 10, marginBottom: 5 },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
  },
  inputSm: { paddingVertical: 8, fontSize: 13 },
  inputDisabled: { backgroundColor: 'rgba(255, 255, 255, 0.02)', color: '#64748B' },
  row2: { flexDirection: 'row', gap: 10 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#E2E8F0' },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  slotChipActive: { backgroundColor: '#0284C7', borderColor: '#38BDF8' },
  slotChipTitle: { fontSize: 12, fontWeight: '800', color: '#38BDF8' },
  slotChipSub: { fontSize: 11, fontWeight: '600', color: '#7DD3FC', marginTop: 1 },
  dateSelected: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  dayChip: {
    width: 50,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  dayChipSunday: { borderColor: 'rgba(56, 189, 248, 0.35)', backgroundColor: 'rgba(56, 189, 248, 0.1)' },
  dayChipWeek: { fontSize: 10, fontWeight: '800', color: '#94A3B8' },
  dayChipNum: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  netChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  netChipActive: { backgroundColor: '#0284C7', borderColor: '#38BDF8' },
  netChipText: { fontSize: 12, fontWeight: '700', color: '#E2E8F0' },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  templateBtnText: { color: '#38BDF8', fontSize: 12, fontWeight: '800' },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  autoText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  itemCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderLeftWidth: 4,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    overflow: 'hidden',
  },
  itemSummary: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  itemTimeBox: { width: 62 },
  itemTime: { fontSize: 12, fontWeight: '800', color: '#38BDF8' },
  itemDur: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  itemTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  itemResp: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  itemEditor: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    overflow: 'hidden',
  },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 10 },
  stepInput: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  miniChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  miniChipText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  itemActions: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  itemActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deleteText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
  },
  addBtnText: { color: '#38BDF8', fontWeight: '800', fontSize: 13 },
  volRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  volRemove: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: 'rgba(7, 10, 20, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  // Ministry assignment styles
  minCardRow: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    marginBottom: 10,
  },
  minHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  minIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  minSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  minAssignmentDetails: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  minCoordBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  minCoordLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  minCoordName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  minCoordPhone: {
    fontSize: 11,
    color: '#38BDF8',
    marginTop: 1,
  },
  minChangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  minChangeBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  pickMemberSmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 4,
    height: 38,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  pickMemberSmBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
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
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
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
});
