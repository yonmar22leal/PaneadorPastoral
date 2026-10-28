import { useChurch } from '@/context/ChurchContext';
import {
  calcAge,
  classifyPerson,
  latestReportDate,
  parseAge,
  PREJUVENIL_MAX_AGE,
  summarizeReports,
  uniqueReportDates,
} from '@/lib/attendance';
import { DiscipleAttendanceItem, PersonGender, ReportVisitorItem } from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DoodleBackground } from '@/components/doodle-background';

export default function AttendanceScreen() {
  const {
    currentUser,
    members,
    saveAttendance,
    servicesSchedule,
    getMyDisciples,
    getMyLeaderAttendanceReports,
    leaderAttendanceReports,
    submitLeaderReport,
    getLeaderInCharge,
  } = useChurch();

  const leaderInCharge = getLeaderInCharge(currentUser);
  const myLeaderAttendanceReports = getMyLeaderAttendanceReports();
  const isPastor = currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  // Filtrar servicios permitidos según la red del usuario: solo su red y el servicio de adoración
  const allowedServices = servicesSchedule.filter((srv) => {
    if (currentUser?.role === 'senior_pastor') return true;
    if (srv.id === 'viernes_adoracion' || srv.network === 'general') return true;
    if (currentUser?.network === 'juvenil') return srv.network === 'juvenil';
    if (currentUser?.network === 'adulta') return srv.network === 'adulta';
    return false;
  });

  const defaultServiceId =
    currentUser?.network === 'juvenil'
      ? 'domingo_juvenil'
      : allowedServices[0]?.id || 'domingo_adultos_1';

  // ==========================================
  // ESTADO PARA PASTORES (CONTEO POR REPORTES)
  // ==========================================
  const [pastorTab, setPastorTab] = useState<'consolidado' | 'reportes'>('consolidado');
  const [selectedServiceId, setSelectedServiceId] = useState(defaultServiceId);

  // Filtrar los reportes según la red: pastores de red SOLO ven reportes de su red y adoración
  const networkReports = useMemo(() => {
    if (currentUser?.role === 'senior_pastor') {
      return leaderAttendanceReports;
    }
    if (currentUser?.role === 'network_pastor') {
      const pastorNet = currentUser.network;
      return leaderAttendanceReports.filter((rep) => {
        if (rep.recipientLeaderId === currentUser.id) return true;
        if (
          rep.recipientLeaderName &&
          rep.recipientLeaderName.toLowerCase().includes(currentUser.firstName.toLowerCase())
        ) {
          return true;
        }
        if (pastorNet === 'juvenil') {
          return rep.serviceId === 'domingo_juvenil' || rep.serviceId === 'viernes_adoracion';
        }
        if (pastorNet === 'adulta') {
          return (
            rep.serviceId === 'domingo_adultos_1' ||
            rep.serviceId === 'domingo_adultos_2' ||
            rep.serviceId === 'viernes_adoracion'
          );
        }
        const author = members.find((m) => m.id === rep.leaderId);
        return author?.network === pastorNet;
      });
    }
    return leaderAttendanceReports.filter((r) => r.leaderId === currentUser?.id);
  }, [currentUser, leaderAttendanceReports, members]);

  // Fechas disponibles en los reportes de su red
  const availableDates = useMemo(() => {
    const dates = uniqueReportDates(networkReports);
    const today = new Date().toISOString().split('T')[0];
    if (!dates.includes(today)) dates.unshift(today);
    return dates;
  }, [networkReports]);

  const [selectedDate, setSelectedDate] = useState<string>(
    latestReportDate(networkReports) || availableDates[0]
  );

  // Reportes filtrados por servicio y fecha seleccionados para el pastor
  const reportsForSelectedService = useMemo(() => {
    return networkReports.filter(
      (r) => r.serviceId === selectedServiceId && r.serviceDate === selectedDate
    );
  }, [networkReports, selectedServiceId, selectedDate]);

  // Consolidado exacto de Hombres, Mujeres y Prejuvenil (<14 años)
  const serviceSummary = useMemo(() => {
    return summarizeReports(reportsForSelectedService, members);
  }, [reportsForSelectedService, members]);

  // ==========================================
  // ESTADO PARA LÍDERES (ENVÍO DE REPORTE)
  // ==========================================
  const myDisciples = getMyDisciples();
  const userComputedAge = calcAge(currentUser?.birthDate);
  const [myAttendance, setMyAttendance] = useState(true);

  // Anulación opcional si el usuario decide editar manualmente su sexo o edad en este reporte
  const [leaderGenderOverride, setLeaderGenderOverride] = useState<PersonGender | null>(null);
  const [leaderAgeOverride, setLeaderAgeOverride] = useState<string | null>(null);

  const leaderGender: PersonGender = leaderGenderOverride ?? currentUser?.gender ?? 'M';
  const leaderAge: string =
    leaderAgeOverride ?? (userComputedAge !== undefined ? String(userComputedAge) : '28');

  const setLeaderGender = (g: PersonGender) => setLeaderGenderOverride(g);
  const setLeaderAge = (a: string) => setLeaderAgeOverride(a);

  // Discípulos manuales (personas sin cuenta / sin teléfono)
  const [manualDisciples, setManualDisciples] = useState<DiscipleAttendanceItem[]>([]);

  // Modificaciones locales sobre los discípulos registrados (asistencia, ajustes de edad/sexo)
  const [registeredOverrides, setRegisteredOverrides] = useState<
    Record<string, { attended?: boolean; gender?: PersonGender; age?: number }>
  >({});

  // Lista unificada de discípulos: registrados con auto-fill + agregados manuales
  const disciplesState: DiscipleAttendanceItem[] = useMemo(() => {
    const registered: DiscipleAttendanceItem[] = myDisciples.map((d) => {
      const override = registeredOverrides[d.id];
      const computedAge = calcAge(d.birthDate);
      return {
        memberId: d.id,
        name: `${d.firstName} ${d.lastName}`,
        attended: override?.attended !== undefined ? override.attended : true,
        gender: override?.gender || d.gender || 'M',
        age:
          override?.age !== undefined
            ? override.age
            : computedAge !== undefined
              ? computedAge
              : d.network === 'juvenil'
                ? 16
                : 30,
      };
    });
    return [...registered, ...manualDisciples];
  }, [myDisciples, registeredOverrides, manualDisciples]);

  const [expandedDiscipleId, setExpandedDiscipleId] = useState<string | null>(null);

  // Nuevo discípulo manual (sin cuenta / sin teléfono)
  const [newDiscipleName, setNewDiscipleName] = useState('');
  const [newDiscipleGender, setNewDiscipleGender] = useState<PersonGender>('M');
  const [newDiscipleAge, setNewDiscipleAge] = useState('16');

  // Lista de invitados estructurada con Sexo y Edad
  const [visitorsList, setVisitorsList] = useState<ReportVisitorItem[]>([
    { id: 'vis-1', name: 'Kevin Hernández', gender: 'M', age: 16 },
    { id: 'vis-2', name: 'Andrea Colmenares', gender: 'F', age: 13 }, // Prejuvenil (<14)
  ]);
  const [newVisitorName, setNewVisitorName] = useState('');
  const [newVisitorGender, setNewVisitorGender] = useState<PersonGender>('M');
  const [newVisitorAge, setNewVisitorAge] = useState('15');

  const [leaderNotes, setLeaderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentServiceObj =
    allowedServices.find((s) => s.id === selectedServiceId) ||
    allowedServices[0] ||
    servicesSchedule[0];

  // ==========================
  // HANDLERS LÍDER
  // ==========================
  const toggleDisciple = (index: number) => {
    const target = disciplesState[index];
    if (!target) return;
    if (target.memberId.startsWith('manual-')) {
      setManualDisciples((prev) =>
        prev.map((m) => (m.memberId === target.memberId ? { ...m, attended: !m.attended } : m))
      );
    } else {
      setRegisteredOverrides((prev) => ({
        ...prev,
        [target.memberId]: {
          ...prev[target.memberId],
          attended: !target.attended,
        },
      }));
    }
  };

  const markAllRegistered = (attended: boolean) => {
    setRegisteredOverrides((prev) => {
      const next = { ...prev };
      myDisciples.forEach((d) => {
        next[d.id] = { ...next[d.id], attended };
      });
      return next;
    });
  };

  const updateDiscipleGender = (index: number, gender: PersonGender) => {
    const target = disciplesState[index];
    if (!target) return;
    if (target.memberId.startsWith('manual-')) {
      setManualDisciples((prev) =>
        prev.map((m) => (m.memberId === target.memberId ? { ...m, gender } : m))
      );
    } else {
      setRegisteredOverrides((prev) => ({
        ...prev,
        [target.memberId]: {
          ...prev[target.memberId],
          gender,
        },
      }));
    }
  };

  const updateDiscipleAge = (index: number, ageStr: string) => {
    const target = disciplesState[index];
    if (!target) return;
    const age = parseAge(ageStr);
    if (target.memberId.startsWith('manual-')) {
      setManualDisciples((prev) =>
        prev.map((m) => (m.memberId === target.memberId ? { ...m, age } : m))
      );
    } else {
      setRegisteredOverrides((prev) => ({
        ...prev,
        [target.memberId]: {
          ...prev[target.memberId],
          age,
        },
      }));
    }
  };

  const handleAddManualDisciple = () => {
    if (!newDiscipleName.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del participante.');
      return;
    }
    const ageNum = parseAge(newDiscipleAge);
    setManualDisciples((prev) => [
      ...prev,
      {
        memberId: `manual-${Date.now()}`,
        name: newDiscipleName.trim(),
        attended: true,
        gender: newDiscipleGender,
        age: ageNum !== undefined ? ageNum : currentUser?.network === 'juvenil' ? 16 : 30,
      },
    ]);
    setNewDiscipleName('');
    Alert.alert('Agregado', `${newDiscipleName.trim()} fue agregado a este reporte.`);
  };

  const handleRemoveManualDisciple = (memberId: string) => {
    setManualDisciples((prev) => prev.filter((it) => it.memberId !== memberId));
  };

  const handleAddVisitor = () => {
    if (!newVisitorName.trim()) return;
    const ageNum = parseAge(newVisitorAge);
    setVisitorsList((prev) => [
      ...prev,
      {
        id: `vis-${Date.now()}`,
        name: newVisitorName.trim(),
        gender: newVisitorGender,
        age: ageNum,
      },
    ]);
    setNewVisitorName('');
  };

  const handleRemoveVisitor = (id: string) => {
    setVisitorsList((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSubmitLeaderReport = async () => {
    setSubmitting(true);
    try {
      const leaderName = currentUser
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : 'Líder 12';
      const todayStr = new Date().toISOString().split('T')[0];

      await submitLeaderReport({
        leaderId: currentUser?.id || 'lider-temp',
        leaderName,
        recipientLeaderId: leaderInCharge.id,
        recipientLeaderName: leaderInCharge.name,
        serviceId: currentServiceObj.id,
        serviceDate: todayStr,
        myAttendance,
        leaderGender,
        leaderAge: parseAge(leaderAge),
        disciples: disciplesState,
        visitorsCount: visitorsList.length,
        visitorNames: visitorsList.map((v) => v.name),
        visitors: visitorsList,
        notes: leaderNotes.trim() || undefined,
      });

      Alert.alert(
        '¡Reporte Enviado!',
        `Tu reporte para ${currentServiceObj.name} ha sido enviado exitosamente a tu pastor/líder: ${leaderInCharge.name}. Se sumará al conteo oficial de Hombres, Mujeres y Prejuvenil.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Guardar consolidado de pastor como registro oficial
  const handleSaveConsolidatedAsOfficial = () => {
    saveAttendance({
      date: selectedDate,
      serviceId: currentServiceObj.id,
      serviceName: `${currentServiceObj.name} (${currentServiceObj.time})`,
      network: currentServiceObj.network,
      menCount: serviceSummary.hombres,
      womenCount: serviceSummary.mujeres,
      kidsCount: serviceSummary.prejuvenil, // Prejuvenil (<14 años)
      visitorsCount: serviceSummary.visitors,
      notes: `Asistencia consolidada desde ${serviceSummary.reportsCount} reportes de líderes G12. Prejuveniles (<14): ${serviceSummary.prejuvenil}.`,
    });

    Alert.alert(
      'Asistencia Oficial Guardada',
      `Se guardó el registro oficial para ${currentServiceObj.name}:\n• Total: ${serviceSummary.total}\n• Hombres: ${serviceSummary.hombres}\n• Mujeres: ${serviceSummary.mujeres}\n• Prejuveniles (<14): ${serviceSummary.prejuvenil}\n• Visitas: ${serviceSummary.visitors}`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <DoodleBackground>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ============================================================== */}
        {/* IF CURRENT USER IS NOT PASTOR (LEADER / MEMBER VIEW)           */}
        {/* ============================================================== */}
        {!isPastor ? (
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.leaderBadgeRow}>
                <Ionicons name="shield-checkmark" size={14} color="#2563EB" />
                <Text style={styles.leaderBadgeText}>
                  {currentUser?.role === 'g12_leader' ? 'Líder de 12' : 'Miembro'} •{' '}
                  {currentUser?.network === 'juvenil' ? 'Red Juvenil' : 'Red Adulta'}
                </Text>
              </View>
              <Text style={styles.headerTitle}>Reporte de Asistencia</Text>
              <Text style={styles.headerSubtitle}>
                Reporta a tus discípulos e invitados con sexo y edad para el conteo de Hombres, Mujeres y Prejuveniles (&lt;14 años)
              </Text>
            </View>

            {/* Recipient Notice Card */}
            <View style={styles.recipientNoticeCard}>
              <Ionicons name="paper-plane" size={18} color="#2563EB" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.recipientNoticeTitle}>Líder Encargado (Recibe este Reporte):</Text>
                <Text style={styles.recipientNoticeName}>
                  {leaderInCharge.name} ({currentUser?.network === 'juvenil' ? 'Pastor de Jóvenes' : 'Cobertura Pastoral'})
                </Text>
              </View>
            </View>

            {/* 1. Service Selection */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>1. Selecciona el Servicio</Text>
              <Text style={styles.fieldDesc}>Servicio al que asistieron:</Text>
              <View style={styles.serviceChipsGrid}>
                {allowedServices.map((srv) => (
                  <TouchableOpacity
                    key={srv.id}
                    style={[
                      styles.serviceChip,
                      selectedServiceId === srv.id && styles.serviceChipActive,
                    ]}
                    onPress={() => setSelectedServiceId(srv.id)}>
                    <Text
                      style={[
                        styles.serviceChipText,
                        selectedServiceId === srv.id && styles.serviceChipTextActive,
                      ]}>
                      {srv.name} ({srv.time.split(' - ')[0]})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 2. My Personal Attendance */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>2. Mi Asistencia Personal</Text>
                  <Text style={styles.fieldDesc}>
                    ¿Asististe tú al servicio en el templo?
                  </Text>
                </View>
                <Switch
                  value={myAttendance}
                  onValueChange={setMyAttendance}
                  trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {myAttendance && (
                <View>
                  <View style={styles.leaderProfileRow}>
                    <Text style={styles.smallLabel}>Tu Sexo:</Text>
                    <View style={styles.genderRow}>
                      <TouchableOpacity
                        style={[styles.genderChip, leaderGender === 'M' && styles.genderChipActiveM]}
                        onPress={() => setLeaderGender('M')}>
                        <Text style={[styles.genderChipText, leaderGender === 'M' && styles.genderChipTextActive]}>
                          Hombre
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.genderChip, leaderGender === 'F' && styles.genderChipActiveF]}
                        onPress={() => setLeaderGender('F')}>
                        <Text style={[styles.genderChipText, leaderGender === 'F' && styles.genderChipTextActive]}>
                          Mujer
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.smallLabel, { marginLeft: 12 }]}>Edad:</Text>
                    <TextInput
                      style={styles.ageInput}
                      keyboardType="number-pad"
                      value={leaderAge}
                      onChangeText={setLeaderAge}
                      placeholder="25"
                      maxLength={3}
                    />
                    {parseAge(leaderAge) !== undefined && parseAge(leaderAge)! < PREJUVENIL_MAX_AGE && (
                      <View style={styles.prejuvenilBadge}>
                        <Text style={styles.prejuvenilBadgeText}>Prejuvenil (&lt;14)</Text>
                      </View>
                    )}
                  </View>
                  {calcAge(currentUser?.birthDate) !== undefined ? (
                    <Text style={styles.fromProfileHint}>
                      ✓ Autocompletado desde tu perfil ({currentUser?.gender === 'F' ? 'Mujer' : 'Hombre'} • {calcAge(currentUser?.birthDate)} años)
                    </Text>
                  ) : (
                    <Text style={styles.fromProfileMissingHint}>
                      💡 Puedes guardar tu sexo y fecha de nacimiento en tu Perfil (en Inicio) para no tener que llenarlo cada vez.
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* 3. Disciples Checklist with Sex & Age for Automatic Classification */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>3. Asistencia de mis Discípulos</Text>
                  <Text style={styles.fieldDesc}>
                    Clasificación automática por sexo y edad de su cuenta ({disciplesState.filter((d) => d.attended).length} presentes):
                  </Text>
                </View>
              </View>

              {/* A. DISCÍPULOS REGISTRADOS CON CUENTA */}
              <View style={styles.disciplesBatchRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="people" size={16} color="#1E3A8A" />
                  <Text style={styles.disciplesSubheader}>
                    Discípulos con Cuenta ({disciplesState.filter((d) => !d.memberId.startsWith('manual-')).length})
                  </Text>
                </View>
                {disciplesState.some((d) => !d.memberId.startsWith('manual-')) && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.batchBtn}
                      onPress={() => markAllRegistered(true)}>
                      <Ionicons name="checkmark-done" size={13} color="#2563EB" />
                      <Text style={styles.batchBtnText}>Todos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.batchBtn}
                      onPress={() => markAllRegistered(false)}>
                      <Ionicons name="close" size={13} color="#64748B" />
                      <Text style={[styles.batchBtnText, { color: '#64748B' }]}>Ninguno</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {disciplesState.filter((d) => !d.memberId.startsWith('manual-')).length === 0 ? (
                <View style={styles.noDisciplesNotice}>
                  <Ionicons name="information-circle-outline" size={20} color="#64748B" />
                  <Text style={styles.noDisciplesText}>
                    Aún no tienes discípulos registrados con cuenta bajo tu cobertura. Tus discípulos pueden inscribirse en la app seleccionándote como su líder.
                  </Text>
                </View>
              ) : (
                <View style={styles.disciplesList}>
                  {disciplesState.map((d, index) => {
                    if (d.memberId.startsWith('manual-')) return null;
                    const category = classifyPerson(d.gender, d.age);
                    const isPj = category === 'prejuvenil';
                    const isExpanded = expandedDiscipleId === d.memberId;

                    return (
                      <View
                        key={d.memberId}
                        style={[
                          styles.discipleCard,
                          d.attended && styles.discipleCardAttended,
                        ]}>
                        <TouchableOpacity
                          style={styles.discipleCardHeader}
                          onPress={() => toggleDisciple(index)}
                          activeOpacity={0.8}>
                          <View
                            style={[
                              styles.discipleAvatar,
                              {
                                backgroundColor:
                                  d.gender === 'F' ? '#FCE7F3' : '#DBEAFE',
                              },
                            ]}>
                            <Text
                              style={[
                                styles.discipleAvatarText,
                                {
                                  color:
                                    d.gender === 'F' ? '#BE185D' : '#1D4ED8',
                                },
                              ]}>
                              {d.name[0]}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.discipleName}>{d.name}</Text>
                            <View
                              style={{
                                flexDirection: 'row',
                                gap: 6,
                                alignItems: 'center',
                                marginTop: 2,
                              }}>
                              <Text style={styles.discipleStatus}>
                                {d.attended ? 'Presente' : 'Ausente'}
                              </Text>

                              <View
                                style={[
                                  styles.categoryMiniBadge,
                                  isPj
                                    ? { backgroundColor: '#EDE9FE' }
                                    : d.gender === 'F'
                                      ? { backgroundColor: '#FCE7F3' }
                                      : { backgroundColor: '#DBEAFE' },
                                ]}>
                                <Text
                                  style={[
                                    styles.categoryMiniBadgeText,
                                    isPj
                                      ? { color: '#6D28D9' }
                                      : d.gender === 'F'
                                        ? { color: '#9D174D' }
                                        : { color: '#1E40AF' },
                                  ]}>
                                  {isPj
                                    ? `Prejuvenil (<14) • ${d.age ?? '--'}a`
                                    : d.gender === 'F'
                                      ? `Mujer • ${d.age ?? '--'}a`
                                      : `Hombre • ${d.age ?? '--'}a`}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <TouchableOpacity
                              onPress={() =>
                                setExpandedDiscipleId(isExpanded ? null : d.memberId)
                              }
                              style={styles.adjustPill}>
                              <Ionicons
                                name={isExpanded ? 'chevron-up' : 'pencil'}
                                size={12}
                                color="#64748B"
                              />
                            </TouchableOpacity>
                            <Ionicons
                              name={d.attended ? 'checkbox' : 'square-outline'}
                              size={24}
                              color={d.attended ? '#1E3A8A' : '#94A3B8'}
                            />
                          </View>
                        </TouchableOpacity>

                        {/* Modificación opcional si se desea ajustar para este reporte */}
                        {isExpanded && (
                          <View style={styles.personMetaEditor}>
                            <Text style={styles.personMetaLabel}>Ajustar Sexo:</Text>
                            <View style={styles.genderRowSm}>
                              <TouchableOpacity
                                style={[
                                  styles.genderChipSm,
                                  d.gender === 'M' && styles.genderChipActiveM,
                                ]}
                                onPress={() => updateDiscipleGender(index, 'M')}>
                                <Text
                                  style={[
                                    styles.genderChipTextSm,
                                    d.gender === 'M' && styles.genderChipTextActive,
                                  ]}>
                                  Hombre
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.genderChipSm,
                                  d.gender === 'F' && styles.genderChipActiveF,
                                ]}
                                onPress={() => updateDiscipleGender(index, 'F')}>
                                <Text
                                  style={[
                                    styles.genderChipTextSm,
                                    d.gender === 'F' && styles.genderChipTextActive,
                                  ]}>
                                  Mujer
                                </Text>
                              </TouchableOpacity>
                            </View>

                            <Text style={[styles.personMetaLabel, { marginLeft: 10 }]}>Edad:</Text>
                            <TextInput
                              style={styles.personMetaAgeInput}
                              keyboardType="number-pad"
                              value={d.age !== undefined ? String(d.age) : ''}
                              placeholder="Ej: 13"
                              placeholderTextColor="#94A3B8"
                              maxLength={3}
                              onChangeText={(v) => updateDiscipleAge(index, v)}
                            />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* B. PARTICIPANTES MANUALES (SIN CUENTA / SIN TELÉFONO) */}
              {disciplesState.filter((d) => d.memberId.startsWith('manual-')).length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.disciplesSubheader}>
                    Participantes agregados sin cuenta ({disciplesState.filter((d) => d.memberId.startsWith('manual-')).length})
                  </Text>
                  <View style={[styles.disciplesList, { marginTop: 8 }]}>
                    {disciplesState.map((d, index) => {
                      if (!d.memberId.startsWith('manual-')) return null;
                      const isPj = typeof d.age === 'number' && d.age < PREJUVENIL_MAX_AGE;
                      return (
                        <View key={d.memberId} style={[styles.discipleCard, styles.discipleCardAttended]}>
                          <View style={styles.discipleCardHeader}>
                            <View style={[styles.discipleAvatar, { backgroundColor: '#FEF3C7' }]}>
                              <Text style={[styles.discipleAvatarText, { color: '#B45309' }]}>
                                {d.name[0]}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.discipleName}>{d.name}</Text>
                              <Text style={styles.visitorCardMeta}>
                                📝 Sin cuenta • {d.gender === 'F' ? 'Mujer' : 'Hombre'} • {d.age ?? '--'} años •{' '}
                                <Text style={{ fontWeight: '700', color: isPj ? '#6D28D9' : '#0F172A' }}>
                                  {isPj ? 'Prejuvenil (<14)' : d.gender === 'F' ? 'Red Mujeres' : 'Red Hombres'}
                                </Text>
                              </Text>
                            </View>
                            <TouchableOpacity onPress={() => handleRemoveManualDisciple(d.memberId)}>
                              <Ionicons name="trash-outline" size={18} color="#DC2626" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Formulario para agregar participante manual */}
              <View style={styles.addDiscipleBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Ionicons name="person-add" size={15} color="#2563EB" />
                  <Text style={styles.addSectionSub}>
                    Agregar participante manual (sin cuenta / sin teléfono)
                  </Text>
                </View>
                <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 10 }}>
                  Para quienes aún no tienen teléfono o cuenta creada. Se contabilizarán automáticamente.
                </Text>
                <TextInput
                  style={styles.textInputSm}
                  placeholder="Nombre y Apellido del participante..."
                  placeholderTextColor="#94A3B8"
                  value={newDiscipleName}
                  onChangeText={setNewDiscipleName}
                />
                <View style={styles.rowInline}>
                  <View style={styles.genderRowSm}>
                    <TouchableOpacity
                      style={[styles.genderChipSm, newDiscipleGender === 'M' && styles.genderChipActiveM]}
                      onPress={() => setNewDiscipleGender('M')}>
                      <Text style={[styles.genderChipTextSm, newDiscipleGender === 'M' && styles.genderChipTextActive]}>
                        👨 Hombre
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderChipSm, newDiscipleGender === 'F' && styles.genderChipActiveF]}
                      onPress={() => setNewDiscipleGender('F')}>
                      <Text style={[styles.genderChipTextSm, newDiscipleGender === 'F' && styles.genderChipTextActive]}>
                        👩 Mujer
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.ageInputSm}
                    keyboardType="number-pad"
                    placeholder="Edad"
                    placeholderTextColor="#94A3B8"
                    value={newDiscipleAge}
                    onChangeText={setNewDiscipleAge}
                    maxLength={3}
                  />
                  <TouchableOpacity style={styles.addBtnSm} onPress={handleAddManualDisciple}>
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.addBtnSmText}>Añadir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 4. Visitors with Sex & Age */}
            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>4. Invitados Nuevos ({visitorsList.length})</Text>
                  <Text style={styles.fieldDesc}>
                    Registra amigos y familiares traídos hoy. Indica su edad para saber si son Prejuveniles (&lt;14 años):
                  </Text>
                </View>
              </View>

              {visitorsList.map((v) => {
                const isPj = typeof v.age === 'number' && v.age < PREJUVENIL_MAX_AGE;
                return (
                  <View key={v.id} style={styles.visitorRowCard}>
                    <View style={styles.visitorIconCircle}>
                      <Ionicons
                        name={isPj ? 'school' : v.gender === 'F' ? 'woman' : 'man'}
                        size={16}
                        color={isPj ? '#6D28D9' : v.gender === 'F' ? '#9D174D' : '#1E40AF'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visitorCardName}>{v.name}</Text>
                      <Text style={styles.visitorCardMeta}>
                        {v.gender === 'F' ? 'Mujer' : 'Hombre'} • {v.age ?? '--'} años •{' '}
                        <Text style={{ fontWeight: '700', color: isPj ? '#6D28D9' : '#0F172A' }}>
                          {isPj ? 'Prejuvenil (<14)' : v.gender === 'F' ? 'Red Mujeres' : 'Red Hombres'}
                        </Text>
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => handleRemoveVisitor(v.id)}>
                      <Ionicons name="close-circle" size={20} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Agregar nuevo invitado */}
              <View style={styles.addVisitorBox}>
                <Text style={styles.addSectionSub}>Agregar nuevo invitado:</Text>
                <TextInput
                  style={styles.textInputSm}
                  placeholder="Nombre de la visita..."
                  placeholderTextColor="#94A3B8"
                  value={newVisitorName}
                  onChangeText={setNewVisitorName}
                />
                <View style={styles.rowInline}>
                  <View style={styles.genderRowSm}>
                    <TouchableOpacity
                      style={[styles.genderChipSm, newVisitorGender === 'M' && styles.genderChipActiveM]}
                      onPress={() => setNewVisitorGender('M')}>
                      <Text style={[styles.genderChipTextSm, newVisitorGender === 'M' && styles.genderChipTextActive]}>
                        Hombre
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.genderChipSm, newVisitorGender === 'F' && styles.genderChipActiveF]}
                      onPress={() => setNewVisitorGender('F')}>
                      <Text style={[styles.genderChipTextSm, newVisitorGender === 'F' && styles.genderChipTextActive]}>
                        Mujer
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.ageInputSm}
                    keyboardType="number-pad"
                    placeholder="Edad"
                    placeholderTextColor="#94A3B8"
                    value={newVisitorAge}
                    onChangeText={setNewVisitorAge}
                    maxLength={3}
                  />
                  <TouchableOpacity style={styles.addBtnSm} onPress={handleAddVisitor}>
                    <Ionicons name="person-add" size={15} color="#FFFFFF" />
                    <Text style={styles.addBtnSmText}>Agregar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 5. Notes to Pastor */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>5. Mensaje o Petición para tu Pastor</Text>
              <TextInput
                style={[styles.textInput, { height: 70 }]}
                placeholder="Escribe alguna observación de tu equipo o petición de oración..."
                placeholderTextColor="#94A3B8"
                multiline
                value={leaderNotes}
                onChangeText={setLeaderNotes}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitReportBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmitLeaderReport}
              disabled={submitting}
              activeOpacity={0.85}>
              <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
              <Text style={styles.submitReportBtnText}>
                {submitting ? 'Enviando Reporte...' : 'Enviar Reporte a mi Pastor'}
              </Text>
            </TouchableOpacity>

            {/* Recent Reports History */}
            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>Mis Últimos Reportes Enviados</Text>
              {myLeaderAttendanceReports
                .filter((r) => r.leaderId === currentUser?.id)
                .slice(0, 3)
                .map((r) => (
                  <View key={r.id} style={styles.historyItem}>
                    <Ionicons name="checkmark-done" size={18} color="#059669" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyService}>{r.serviceId}</Text>
                      <Text style={styles.historyDate}>
                        Fecha: {r.serviceDate} • {r.visitorsCount} visitas •{' '}
                        {r.disciples.filter((d) => d.attended).length} discípulos
                      </Text>
                      <Text style={styles.historyRecipient}>
                        📬 Enviado a: {r.recipientLeaderName || leaderInCharge.name}
                      </Text>
                    </View>
                  </View>
                ))}
            </View>
          </View>
        ) : (
          /* ============================================================== */
          /* IF CURRENT USER IS PASTOR (CONSOLIDADO POR REPORTES G12)       */
          /* ============================================================== */
          <View>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Pase & Control de Asistencia</Text>
              <Text style={styles.headerSubtitle}>
                La asistencia del servicio la da el conteo de los reportes: Hombres, Mujeres y Prejuveniles (&lt;14 años)
              </Text>
            </View>

            {/* Selector de Servicio */}
            <View style={styles.serviceSelectorContainer}>
              {allowedServices.map((srv) => (
                <TouchableOpacity
                  key={srv.id}
                  style={[
                    styles.serviceChip,
                    selectedServiceId === srv.id && styles.serviceChipActive,
                  ]}
                  onPress={() => setSelectedServiceId(srv.id)}>
                  <Text
                    style={[
                      styles.serviceChipText,
                      selectedServiceId === srv.id && styles.serviceChipTextActive,
                    ]}>
                    {srv.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Selector de Fecha */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateSelectorRow}>
              {availableDates.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dateChip, selectedDate === d && styles.dateChipActive]}
                  onPress={() => setSelectedDate(d)}>
                  <Ionicons
                    name="calendar-outline"
                    size={12}
                    color={selectedDate === d ? '#FFFFFF' : '#475569'}
                  />
                  <Text style={[styles.dateChipText, selectedDate === d && styles.dateChipTextActive]}>
                    {d}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Segmented Control */}
            <View style={styles.segmentedRow}>
              <TouchableOpacity
                style={[styles.segmentBtn, pastorTab === 'consolidado' && styles.segmentBtnActive]}
                onPress={() => setPastorTab('consolidado')}>
                <Ionicons
                  name="analytics"
                  size={16}
                  color={pastorTab === 'consolidado' ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.segmentText,
                    pastorTab === 'consolidado' && styles.segmentTextActive,
                  ]}>
                  Conteo por Reportes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, pastorTab === 'reportes' && styles.segmentBtnActive]}
                onPress={() => setPastorTab('reportes')}>
                <Ionicons
                  name="file-tray-full"
                  size={16}
                  color={pastorTab === 'reportes' ? '#FFFFFF' : '#64748B'}
                />
                <Text
                  style={[
                    styles.segmentText,
                    pastorTab === 'reportes' && styles.segmentTextActive,
                  ]}>
                  Reportes de Líderes ({reportsForSelectedService.length})
                </Text>
              </TouchableOpacity>
            </View>

            {pastorTab === 'consolidado' ? (
              <View>
                {/* Big Consolidated Service Card */}
                <View style={styles.totalBannerCard}>
                  <View style={styles.totalBannerTop}>
                    <View>
                      <Text style={styles.totalBannerLabel}>
                        ASISTENCIA CONSOLIDADA • {currentServiceObj.name}
                      </Text>
                      <Text style={styles.totalBannerNumber}>{serviceSummary.total}</Text>
                      <Text style={styles.totalBannerSub}>
                        {serviceSummary.reportsCount} reportes recibidos para este servicio
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.saveLiveBtn}
                      onPress={handleSaveConsolidatedAsOfficial}>
                      <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                      <Text style={styles.saveLiveBtnText}>Guardar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Stat Chips: Hombres, Mujeres, Prejuvenil (<14), Visitas */}
                  <View style={styles.consolidatedBadgesGrid}>
                    {/* Hombres */}
                    <View style={[styles.statBoxCard, { backgroundColor: '#DBEAFE', borderLeftColor: '#2563EB' }]}>
                      <View style={styles.statBoxHeader}>
                        <Ionicons name="man" size={18} color="#1E40AF" />
                        <Text style={[styles.statBoxTitle, { color: '#1E40AF' }]}>Hombres</Text>
                      </View>
                      <Text style={[styles.statBoxNumber, { color: '#1E40AF' }]}>
                        {serviceSummary.hombres}
                      </Text>
                      <Text style={[styles.statBoxSub, { color: '#1E40AF' }]}>Hombres &gt;= 14 años</Text>
                    </View>

                    {/* Mujeres */}
                    <View style={[styles.statBoxCard, { backgroundColor: '#FCE7F3', borderLeftColor: '#DB2777' }]}>
                      <View style={styles.statBoxHeader}>
                        <Ionicons name="woman" size={18} color="#9D174D" />
                        <Text style={[styles.statBoxTitle, { color: '#9D174D' }]}>Mujeres</Text>
                      </View>
                      <Text style={[styles.statBoxNumber, { color: '#9D174D' }]}>
                        {serviceSummary.mujeres}
                      </Text>
                      <Text style={[styles.statBoxSub, { color: '#9D174D' }]}>Mujeres &gt;= 14 años</Text>
                    </View>

                    {/* Prejuvenil (<14) */}
                    <View style={[styles.statBoxCard, { backgroundColor: '#EDE9FE', borderLeftColor: '#7C3AED' }]}>
                      <View style={styles.statBoxHeader}>
                        <Ionicons name="school" size={18} color="#6D28D9" />
                        <Text style={[styles.statBoxTitle, { color: '#6D28D9' }]}>Prejuvenil</Text>
                      </View>
                      <Text style={[styles.statBoxNumber, { color: '#6D28D9' }]}>
                        {serviceSummary.prejuvenil}
                      </Text>
                      <Text style={[styles.statBoxSub, { color: '#6D28D9' }]}>Menores de 14 años</Text>
                    </View>

                    {/* Visitas */}
                    <View style={[styles.statBoxCard, { backgroundColor: '#FEF3C7', borderLeftColor: '#F59E0B' }]}>
                      <View style={styles.statBoxHeader}>
                        <Ionicons name="sparkles" size={18} color="#B45309" />
                        <Text style={[styles.statBoxTitle, { color: '#B45309' }]}>Nuevas Visitas</Text>
                      </View>
                      <Text style={[styles.statBoxNumber, { color: '#B45309' }]}>
                        {serviceSummary.visitors}
                      </Text>
                      <Text style={[styles.statBoxSub, { color: '#B45309' }]}>Amigos e invitados</Text>
                    </View>
                  </View>
                </View>

                {/* Resumen de Líderes que reportaron */}
                <View style={styles.reportsSummaryCard}>
                  <Text style={styles.sectionHeading}>
                    Líderes que reportaron para este servicio ({reportsForSelectedService.length})
                  </Text>
                  {reportsForSelectedService.length === 0 ? (
                    <Text style={styles.emptyNoticeText}>
                      Aún no hay reportes de líderes enviados para este servicio en la fecha {selectedDate}.
                    </Text>
                  ) : (
                    reportsForSelectedService.map((rep) => {
                      const repSummary = summarizeReports([rep], members);
                      return (
                        <View key={rep.id} style={styles.leaderSummaryRow}>
                          <View style={styles.leaderSummaryAvatar}>
                            <Text style={styles.leaderSummaryAvatarText}>{rep.leaderName[0]}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.leaderSummaryName}>{rep.leaderName}</Text>
                            <Text style={styles.leaderSummaryMeta}>
                              {repSummary.hombres} Hombres • {repSummary.mujeres} Mujeres • {repSummary.prejuvenil} Prejuveniles
                            </Text>
                          </View>
                          <View style={styles.leaderSummaryTotalBadge}>
                            <Text style={styles.leaderSummaryTotalText}>+{repSummary.total}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            ) : (
              /* Reportes Detallados */
              <View style={styles.reportsListSection}>
                <Text style={styles.sectionHeading}>
                  Detalle de Reportes Recibidos ({reportsForSelectedService.length})
                </Text>
                {reportsForSelectedService.length === 0 ? (
                  <View style={styles.emptyNotice}>
                    <Text style={styles.emptyNoticeText}>
                      No hay reportes de líderes para este servicio en {selectedDate}.
                    </Text>
                  </View>
                ) : (
                  reportsForSelectedService.map((rep) => {
                    const repSummary = summarizeReports([rep], members);
                    const repAuthor = members.find(
                      (m) =>
                        m.id === rep.leaderId ||
                        `${m.firstName} ${m.lastName}`.trim().toLowerCase() ===
                        rep.leaderName.trim().toLowerCase()
                    );
                    const repLeader = repAuthor?.leaderId
                      ? members.find((m) => m.id === repAuthor.leaderId)
                      : null;
                    const recipientDisplay =
                      rep.recipientLeaderName ||
                      (repLeader
                        ? `${repLeader.role === 'network_pastor' || repLeader.role === 'senior_pastor' ? (repLeader.gender === 'F' ? 'Pastora' : 'Pastor') : 'Líder'} ${repLeader.firstName} ${repLeader.lastName}`
                        : repAuthor?.leaderName || leaderInCharge.name);

                    return (
                      <View key={rep.id} style={styles.reportCard}>
                        <View style={styles.reportHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.reportLeaderName}>{rep.leaderName}</Text>
                            <Text style={styles.reportMeta}>
                              Servicio: {rep.serviceId} • {rep.serviceDate}
                            </Text>
                            <View style={styles.recipientRowMeta}>
                              <Ionicons name="paper-plane-outline" size={11} color="#2563EB" />
                              <Text style={styles.recipientRowText}>
                                Enviado a: <Text style={{ fontWeight: '700' }}>{recipientDisplay}</Text>
                              </Text>
                            </View>
                          </View>
                          <View
                            style={[
                              styles.badgePill,
                              { backgroundColor: rep.myAttendance ? '#DCFCE7' : '#FEE2E2' },
                            ]}>
                            <Text
                              style={[
                                styles.badgePillText,
                                { color: rep.myAttendance ? '#15803D' : '#B91C1C' },
                              ]}>
                              {rep.myAttendance ? 'Líder Asistió' : 'Líder Ausente'}
                            </Text>
                          </View>
                        </View>

                        {/* Breakdown */}
                        <View style={styles.reportBreakdownRow}>
                          <View style={styles.miniStat}>
                            <Text style={styles.miniStatVal}>{repSummary.hombres}</Text>
                            <Text style={styles.miniStatLbl}>Hombres</Text>
                          </View>
                          <View style={styles.miniStat}>
                            <Text style={styles.miniStatVal}>{repSummary.mujeres}</Text>
                            <Text style={styles.miniStatLbl}>Mujeres</Text>
                          </View>
                          <View style={styles.miniStat}>
                            <Text style={styles.miniStatVal}>{repSummary.prejuvenil}</Text>
                            <Text style={styles.miniStatLbl}>Prejuvenil</Text>
                          </View>
                          <View style={styles.miniStat}>
                            <Text style={styles.miniStatVal}>{repSummary.visitors}</Text>
                            <Text style={styles.miniStatLbl}>Visitas</Text>
                          </View>
                        </View>

                        {/* Disciples Breakdown */}
                        <View style={{ marginTop: 10 }}>
                          <Text style={styles.disciplesHeaderTitle}>Discípulos Reportados:</Text>
                          {rep.disciples.map((d, i) => {
                            const isPj = typeof d.age === 'number' && d.age < PREJUVENIL_MAX_AGE;
                            return (
                              <View key={i} style={styles.discipleRepRow}>
                                <Ionicons
                                  name={d.attended ? 'checkmark-circle' : 'close-circle'}
                                  size={15}
                                  color={d.attended ? '#059669' : '#DC2626'}
                                />
                                <Text style={styles.discipleRepName}>{d.name}</Text>
                                <Text style={styles.discipleRepTag}>
                                  {isPj ? 'Prejuvenil (<14)' : d.gender === 'F' ? 'Mujer' : 'Hombre'}
                                  {d.age ? ` (${d.age}a)` : ''}
                                </Text>
                              </View>
                            );
                          })}
                        </View>

                        {/* Visitor Names */}
                        {rep.visitorNames && rep.visitorNames.length > 0 && (
                          <View style={styles.visitorsTagRow}>
                            <Ionicons name="people-circle" size={16} color="#D97706" />
                            <Text style={styles.visitorsTagText}>
                              Visitas: {rep.visitorNames.join(', ')}
                            </Text>
                          </View>
                        )}

                        {rep.notes && (
                          <Text style={styles.reportNotes}>
                            &ldquo;{rep.notes}&rdquo;
                          </Text>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
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
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 16,
  },
  leaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  leaderBadgeText: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  recipientNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  recipientNoticeTitle: {
    fontSize: 11,
    color: '#1E40AF',
    fontWeight: '700',
  },
  recipientNoticeName: {
    fontSize: 13,
    color: '#1E3A8A',
    fontWeight: '800',
    marginTop: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  fieldDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10,
    lineHeight: 17,
  },
  serviceChipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  serviceChipActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#1E3A8A',
  },
  serviceChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  serviceChipTextActive: {
    color: '#FFFFFF',
  },
  serviceSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 4,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  dateChipTextActive: {
    color: '#FFFFFF',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaderProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  genderChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  genderChipActiveM: {
    backgroundColor: '#2563EB',
  },
  genderChipActiveF: {
    backgroundColor: '#DB2777',
  },
  genderChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  genderChipTextActive: {
    color: '#FFFFFF',
  },
  ageInput: {
    width: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 6,
  },
  prejuvenilBadge: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  prejuvenilBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6D28D9',
  },
  disciplesList: {
    gap: 10,
    marginTop: 6,
  },
  discipleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  discipleCardAttended: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
  },
  discipleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  discipleAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discipleAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E40AF',
  },
  discipleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  discipleStatus: {
    fontSize: 11,
    color: '#64748B',
  },
  categoryMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  categoryMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  personMetaEditor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  personMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  genderRowSm: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 6,
  },
  genderChipSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  genderChipTextSm: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  personMetaAgeInput: {
    width: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 6,
  },
  personMetaHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6D28D9',
    marginLeft: 8,
    flex: 1,
  },
  noDisciplesNotice: {
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
  },
  noDisciplesText: {
    fontSize: 12,
    color: '#64748B',
  },
  addDiscipleBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  addSectionSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  textInputSm: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 6,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ageInputSm: {
    width: 50,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  addBtnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addBtnSmText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  visitorRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  visitorIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  visitorCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  visitorCardMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  addVisitorBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
  },
  submitReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 20,
  },
  submitReportBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyService: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  historyRecipient: {
    fontSize: 10,
    color: '#2563EB',
    fontWeight: '600',
    marginTop: 2,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
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
  segmentBtnActive: {
    backgroundColor: '#0F172A',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  totalBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  totalBannerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  totalBannerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  totalBannerNumber: {
    fontSize: 38,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
    letterSpacing: -1,
  },
  totalBannerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  saveLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  saveLiveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  consolidatedBadgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statBoxCard: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 4,
  },
  statBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statBoxTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  statBoxNumber: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 6,
  },
  statBoxSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  reportsSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  emptyNotice: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
  },
  emptyNoticeText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  leaderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  leaderSummaryAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderSummaryAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E40AF',
  },
  leaderSummaryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  leaderSummaryMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  leaderSummaryTotalBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  leaderSummaryTotalText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '800',
  },
  reportsListSection: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reportLeaderName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  reportMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  recipientRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  recipientRowText: {
    fontSize: 10,
    color: '#2563EB',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reportBreakdownRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    marginTop: 10,
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
  },
  miniStatVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  miniStatLbl: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  disciplesHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  discipleRepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
  },
  discipleRepName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  discipleRepTag: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  visitorsTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
  },
  visitorsTagText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '600',
  },
  reportNotes: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fromProfileHint: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '700',
    marginTop: 6,
  },
  fromProfileMissingHint: {
    fontSize: 11,
    color: '#D97706',
    marginTop: 6,
    lineHeight: 15,
  },
  disciplesBatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  disciplesSubheader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  batchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  adjustPill: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
});
