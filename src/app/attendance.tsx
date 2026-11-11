import { DoodleBackground } from '@/components/doodle-background';
import { useChurch } from '@/context/ChurchContext';
import {
  calcAge,
  classifyPerson,
  formatDisplayDate,
  getLocalDateString,
  latestReportDate,
  parseAge,
  PREJUVENIL_MAX_AGE,
  summarizeReports,
  uniqueReportDates,
} from '@/lib/attendance';
import {
  DiscipleAttendanceItem,
  LeaderAttendanceReport,
  PersonGender,
  ReportVisitorItem,
} from '@/types/church';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
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

export default function AttendanceScreen() {
  const router = useRouter();
  const {
    currentUser,
    members,
    attendanceRecords,
    saveAttendance,
    servicesSchedule,
    getMyDisciples,
    getMyLeaderAttendanceReports,
    leaderAttendanceReports,
    submitLeaderReport,
    updateLeaderReport,
    deleteLeaderReport,
    getLeaderInCharge,
  } = useChurch();

  const leaderInCharge = getLeaderInCharge(currentUser);
  const myLeaderAttendanceReports = getMyLeaderAttendanceReports();
  const isPastor =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';
  const isLider12 =
    currentUser?.role === 'g12_leader' ||
    currentUser?.isLeaderOf12 ||
    currentUser?.generationLevel === 2;
  const canViewReports = isPastor || isLider12;
  const [activeViewMode, setActiveViewMode] = useState<'form' | 'reports'>(
    isPastor ? 'reports' : 'form'
  );

  // Servicios disponibles de la congregación (Servicio Dominical 11am y Viernes de Adoración)
  const allowedServices = servicesSchedule;
  const defaultServiceId = 'domingo_11am';

  // ==========================================
  // ESTADO PARA PASTORES (CONTEO POR REPORTES)
  // ==========================================
  const [pastorTab, setPastorTab] = useState<'consolidado' | 'reportes'>('consolidado');
  const [selectedServiceId, setSelectedServiceId] = useState(defaultServiceId);

  // Reportes individuales enviados por el usuario actual
  const myIndividualAttendanceReports = useMemo(() => {
    if (!currentUser) return [];
    const myId = currentUser.id;
    const myFullName = `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase().trim();
    const myFirst = currentUser.firstName.toLowerCase().trim();
    return leaderAttendanceReports.filter((r) => {
      if (r.leaderId === myId) return true;
      const author = (r.leaderName || '').toLowerCase().trim();
      return author === myFullName || (myFirst && author.includes(myFirst));
    });
  }, [currentUser, leaderAttendanceReports]);

  // Reportes disponibles: Pastores ven todos los reportes de la congregación; los demás solo los suyos
  const networkReports = useMemo(() => {
    if (isPastor) {
      return leaderAttendanceReports;
    }
    return myIndividualAttendanceReports;
  }, [isPastor, leaderAttendanceReports, myIndividualAttendanceReports]);

  // Fechas disponibles en los reportes de su red
  const localTodayStr = useMemo(() => getLocalDateString(new Date()), []);
  const availableDates = useMemo(() => {
    const dates = uniqueReportDates(networkReports);
    if (!dates.includes(localTodayStr)) dates.unshift(localTodayStr);
    return dates;
  }, [networkReports, localTodayStr]);

  const [selectedDate, setSelectedDate] = useState<string>(
    latestReportDate(networkReports) || localTodayStr
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

  // Registro oficial guardado para la fecha y servicio seleccionados (si existe)
  const existingOfficialRecord = useMemo(() => {
    return attendanceRecords.find(
      (a) => a.date === selectedDate && a.serviceId === selectedServiceId
    );
  }, [attendanceRecords, selectedDate, selectedServiceId]);

  const isSaved = Boolean(existingOfficialRecord);
  const savedTotal = existingOfficialRecord
    ? (existingOfficialRecord.menCount || 0) +
    (existingOfficialRecord.womenCount || 0) +
    (existingOfficialRecord.kidsCount || 0) +
    (existingOfficialRecord.visitorsCount || 0)
    : 0;
  const hasNewReportsPending = isSaved && savedTotal !== serviceSummary.total;

  // Helper para resolver el Líder 12 de un reporte de asistencia
  const resolveLeader12ForReport = useCallback(
    (rep: LeaderAttendanceReport): { id: string; name: string } => {
      const repAuthor = members.find(
        (m) =>
          m.id === rep.leaderId ||
          `${m.firstName} ${m.lastName}`.trim().toLowerCase() ===
          rep.leaderName.trim().toLowerCase()
      );

      const leaderOfAuthor = repAuthor?.leaderId
        ? members.find((m) => m.id === repAuthor.leaderId)
        : null;

      // 1. Si el autor es Pastor principal o de red, es la cabeza de su propio reporte
      if (repAuthor && (repAuthor.role === 'senior_pastor' || repAuthor.role === 'network_pastor')) {
        return {
          id: repAuthor.id,
          name: `${repAuthor.firstName} ${repAuthor.lastName}`.trim(),
        };
      }

      // 2. Si el autor es un 144 (su líder directo existe y NO es pastor, ej: Yonmar Leal)
      if (
        leaderOfAuthor &&
        leaderOfAuthor.role !== 'senior_pastor' &&
        leaderOfAuthor.role !== 'network_pastor'
      ) {
        return {
          id: leaderOfAuthor.id,
          name: `${leaderOfAuthor.firstName} ${leaderOfAuthor.lastName}`.trim(),
        };
      }

      // 3. Si el reporte especifica un destinatario que es Líder 12 (ej: reporte enviado a Líder Yonmar)
      if (rep.recipientLeaderId) {
        const recMember = members.find((m) => m.id === rep.recipientLeaderId);
        if (
          recMember &&
          recMember.role !== 'senior_pastor' &&
          recMember.role !== 'network_pastor'
        ) {
          return {
            id: recMember.id,
            name: `${recMember.firstName} ${recMember.lastName}`.trim(),
          };
        }
      }

      const recName = (rep.recipientLeaderName || '').trim();
      const cleanRec = recName
        .toLowerCase()
        .replace(/^(líder|lider|pastor|pastora)\s+/i, '')
        .trim();
      const isRecPastor =
        cleanRec.includes('josue') ||
        cleanRec.includes('josué') ||
        cleanRec.includes('norelis');

      if (recName && !isRecPastor) {
        const matchingMember = members.find((m) => {
          const full = `${m.firstName} ${m.lastName}`.toLowerCase();
          return full.includes(cleanRec) || cleanRec.includes(m.firstName.toLowerCase());
        });
        if (matchingMember && matchingMember.role !== 'senior_pastor' && matchingMember.role !== 'network_pastor') {
          return {
            id: matchingMember.id,
            name: `${matchingMember.firstName} ${matchingMember.lastName}`.trim(),
          };
        }
        return {
          id: cleanRec,
          name: recName.replace(/^(líder|lider)\s+/i, '').trim(),
        };
      }

      // 4. Si el autor es Líder 12 (nivel 2, o su líder directo es un pastor)
      const isAuthorLider12 =
        repAuthor &&
        (repAuthor.generationLevel === 2 ||
          repAuthor.isLeaderOf12 ||
          (leaderOfAuthor &&
            (leaderOfAuthor.role === 'senior_pastor' ||
              leaderOfAuthor.role === 'network_pastor')));

      if (isAuthorLider12 && repAuthor) {
        return {
          id: repAuthor.id,
          name: `${repAuthor.firstName} ${repAuthor.lastName}`.trim(),
        };
      }

      return {
        id: rep.leaderId || rep.leaderName,
        name: rep.leaderName.trim(),
      };
    },
    [members]
  );

  const isReportFromLeader12 = (
    rep: LeaderAttendanceReport,
    leader12Name: string
  ): boolean => {
    const cleanL12 = leader12Name.toLowerCase().trim();
    const cleanRep = (rep.leaderName || '').toLowerCase().trim();
    return cleanRep.includes(cleanL12) || cleanL12.includes(cleanRep);
  };

  // Agrupación de reportes por Líder 12 con total consolidado exacto y deduplicado
  const groupedAttendanceReports = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; reports: LeaderAttendanceReport[] }
    >();

    for (const rep of reportsForSelectedService) {
      const l12 = resolveLeader12ForReport(rep);
      const key = l12.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, { id: l12.id, name: l12.name, reports: [] });
      }
      map.get(key)!.reports.push(rep);
    }

    return Array.from(map.values()).map((group) => {
      const cleanLeader = group.name.toLowerCase().trim();
      // Ordenar: primero el reporte del propio Líder 12, luego los discípulos 144
      const sortedReports = [...group.reports].sort((a, b) => {
        const aName = (a.leaderName || '').toLowerCase().trim();
        const bName = (b.leaderName || '').toLowerCase().trim();
        const aIsLeader = aName.includes(cleanLeader) || cleanLeader.includes(aName);
        const bIsLeader = bName.includes(cleanLeader) || cleanLeader.includes(bName);
        if (aIsLeader && !bIsLeader) return -1;
        if (!aIsLeader && bIsLeader) return 1;
        return 0;
      });

      // Conteo consolidado del equipo del Líder 12 exacto y deduplicado
      const groupSummary = summarizeReports(sortedReports, members);

      return {
        leader12Id: group.id,
        leader12Name: group.name,
        reports: sortedReports,
        groupSummary,
      };
    });
  }, [reportsForSelectedService, members, resolveLeader12ForReport]);

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
              : 25,
      };
    });
    return [...registered, ...manualDisciples];
  }, [myDisciples, registeredOverrides, manualDisciples]);

  const [expandedDiscipleId, setExpandedDiscipleId] = useState<string | null>(null);

  // Nuevo discípulo manual (sin cuenta / sin teléfono)
  const [newDiscipleName, setNewDiscipleName] = useState('');
  const [newDiscipleGender, setNewDiscipleGender] = useState<PersonGender>('M');
  const [newDiscipleAge, setNewDiscipleAge] = useState('16');

  // Fechas y selección para el formulario de reporte
  const closestSundayStr = useMemo(() => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sunday
    if (day === 0) return localTodayStr;
    const diff = 7 - day;
    d.setDate(d.getDate() + diff);
    return getLocalDateString(d);
  }, [localTodayStr]);

  const [formServiceDate, setFormServiceDate] = useState<string>(localTodayStr);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  // Lista de invitados estructurada con Sexo y Edad (inicia vacía para no inflar reportes)
  const [visitorsList, setVisitorsList] = useState<ReportVisitorItem[]>([]);
  const [newVisitorName, setNewVisitorName] = useState('');
  const [newVisitorGender, setNewVisitorGender] = useState<PersonGender>('M');
  const [newVisitorAge, setNewVisitorAge] = useState('15');

  const [leaderNotes, setLeaderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentServiceObj =
    allowedServices.find((s) => s.id === selectedServiceId) ||
    allowedServices[0] ||
    servicesSchedule[0];

  // Desglose en vivo de Discípulos e Invitados para el formulario
  const formDisciplesBreakdown = useMemo(() => {
    let men = 0;
    let women = 0;
    let prejuvenil = 0;
    disciplesState
      .filter((d) => d.attended)
      .forEach((d) => {
        const cat = classifyPerson(d.gender, d.age);
        if (cat === 'hombres') men++;
        else if (cat === 'mujeres') women++;
        else if (cat === 'prejuvenil') prejuvenil++;
      });
    return {
      total: men + women + prejuvenil,
      men,
      women,
      prejuvenil,
    };
  }, [disciplesState]);

  const formVisitorsBreakdown = useMemo(() => {
    let men = 0;
    let women = 0;
    let prejuvenil = 0;
    visitorsList.forEach((v) => {
      const cat = classifyPerson(v.gender, v.age);
      if (cat === 'hombres') men++;
      else if (cat === 'mujeres') women++;
      else if (cat === 'prejuvenil') prejuvenil++;
    });
    return {
      total: men + women + prejuvenil,
      men,
      women,
      prejuvenil,
    };
  }, [visitorsList]);

  const formTotalPeople =
    (myAttendance ? 1 : 0) +
    formDisciplesBreakdown.total +
    formVisitorsBreakdown.total;

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
        age: ageNum !== undefined ? ageNum : 25,
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

  const canManageReport = useCallback(
    (rep: LeaderAttendanceReport) => {
      if (isPastor) return true;
      if (currentUser?.id && rep.leaderId && currentUser.id === rep.leaderId) return true;
      const cleanMyName = `${currentUser?.firstName} ${currentUser?.lastName}`.toLowerCase().trim();
      const cleanRepName = (rep.leaderName || '').toLowerCase().trim();
      if (cleanMyName && (cleanMyName === cleanRepName || cleanRepName.includes(cleanMyName))) return true;
      if (isLider12) return true;
      return false;
    },
    [isPastor, isLider12, currentUser]
  );

  const handleStartEditReport = (rep: LeaderAttendanceReport) => {
    setEditingReportId(rep.id);
    setSelectedServiceId(rep.serviceId);
    setFormServiceDate(rep.serviceDate);
    setMyAttendance(rep.myAttendance);
    setLeaderGenderOverride(rep.leaderGender || null);
    setLeaderAgeOverride(rep.leaderAge ? String(rep.leaderAge) : null);
    setVisitorsList(rep.visitors || []);
    setLeaderNotes(rep.notes || '');

    const overrides: Record<string, { attended?: boolean; gender?: PersonGender; age?: number }> = {};
    const manuals: DiscipleAttendanceItem[] = [];

    rep.disciples.forEach((d) => {
      if (d.memberId.startsWith('manual-')) {
        manuals.push(d);
      } else {
        overrides[d.memberId] = {
          attended: d.attended,
          gender: d.gender,
          age: d.age,
        };
      }
    });

    setRegisteredOverrides(overrides);
    setManualDisciples(manuals);
    setActiveViewMode('form');
  };

  const handleCancelEdit = () => {
    setEditingReportId(null);
    setRegisteredOverrides({});
    setManualDisciples([]);
    setVisitorsList([]);
    setLeaderNotes('');
    setFormServiceDate(localTodayStr);
  };

  const handleDeleteReport = (rep: LeaderAttendanceReport) => {
    Alert.alert(
      '¿Eliminar Reporte de Asistencia?',
      `¿Estás seguro de que deseas eliminar este reporte de "${rep.leaderName}" correspondiente a ${formatDisplayDate(rep.serviceDate)} (${rep.serviceDate})?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLeaderReport(rep.id);
              if (editingReportId === rep.id) {
                handleCancelEdit();
              }
              Alert.alert('Reporte Eliminado', 'El reporte fue eliminado con éxito.');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'No se pudo eliminar el reporte.');
            }
          },
        },
      ]
    );
  };

  const handleSubmitLeaderReport = async () => {
    setSubmitting(true);
    try {
      const leaderName = currentUser
        ? `${currentUser.firstName} ${currentUser.lastName}`
        : 'Líder';

      const payload = {
        leaderId: currentUser?.id || 'lider-temp',
        leaderName,
        recipientLeaderId: leaderInCharge.id,
        recipientLeaderName: leaderInCharge.name,
        serviceId: currentServiceObj.id,
        serviceDate: formServiceDate,
        myAttendance,
        leaderGender,
        leaderAge: parseAge(leaderAge),
        disciples: disciplesState,
        visitorsCount: visitorsList.length,
        visitorNames: visitorsList.map((v) => v.name),
        visitors: visitorsList,
        notes: leaderNotes.trim() || undefined,
      };

      if (editingReportId) {
        await updateLeaderReport(editingReportId, payload);
        Alert.alert(
          '¡Reporte Actualizado!',
          `Tu reporte para ${currentServiceObj.name} (${formatDisplayDate(formServiceDate)}) ha sido actualizado con éxito.`
        );
        handleCancelEdit();
        setActiveViewMode('reports');
      } else {
        await submitLeaderReport(payload);
        Alert.alert(
          '¡Reporte Enviado!',
          `Tu reporte para ${currentServiceObj.name} (${formatDisplayDate(formServiceDate)}) ha sido enviado exitosamente a tu pastor/líder: ${leaderInCharge.name}. Se sumará al conteo oficial de Hombres, Mujeres y Prejuveniles.`
        );
        handleCancelEdit();
        if (canViewReports) setActiveViewMode('reports');
      }
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
      isSaved ? 'Asistencia Oficial Actualizada' : 'Asistencia Oficial Guardada',
      `${isSaved ? 'Se actualizó' : 'Se guardó'} el registro oficial para ${currentServiceObj.name}:\n• Total: ${serviceSummary.total}\n• Hombres: ${serviceSummary.hombres}\n• Mujeres: ${serviceSummary.mujeres}\n• Prejuveniles (<14): ${serviceSummary.prejuvenil}\n• Visitas: ${serviceSummary.visitors}`
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <StatusBar style="light" />
      <DoodleBackground>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Top Navigation Row con Botón de Regresar */}
          <View style={styles.topNavRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as any))}
              activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.topNavTitle}>
                {isPastor ? 'Control de Asistencia' : 'Reporte de Asistencia'}
              </Text>
              <Text style={styles.topNavSubtitle}>
                {isPastor ? 'IEC Caja de Agua • Consolidado Pastoral' : 'Discipulado G12 • Envío de Reporte'}
              </Text>
            </View>
          </View>
          {/* ============================================================== */}
          {/* SELECTOR DE MODO SUPERIOR: PASTORES VS NO-PASTORES             */}
          {/* ============================================================== */}
          {isPastor ? (
            <View style={styles.topModeSelector}>
              <TouchableOpacity
                style={[
                  styles.topModeBtn,
                  activeViewMode === 'reports' && styles.topModeBtnActive,
                ]}
                onPress={() => setActiveViewMode('reports')}>
                <Ionicons
                  name="analytics"
                  size={16}
                  color={activeViewMode === 'reports' ? '#FFFFFF' : '#1E3A8A'}
                />
                <Text
                  style={[
                    styles.topModeBtnText,
                    activeViewMode === 'reports' && styles.topModeBtnTextActive,
                  ]}>
                  Reportes Totales (Consolidado)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.topModeBtn,
                  activeViewMode === 'form' && styles.topModeBtnActive,
                ]}
                onPress={() => setActiveViewMode('form')}>
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={activeViewMode === 'form' ? '#FFFFFF' : '#1E3A8A'}
                />
                <Text
                  style={[
                    styles.topModeBtnText,
                    activeViewMode === 'form' && styles.topModeBtnTextActive,
                  ]}>
                  {editingReportId ? 'Editar mi Reporte' : 'Enviar mi Reporte'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.topModeSelector}>
              <TouchableOpacity
                style={[
                  styles.topModeBtn,
                  activeViewMode === 'form' && styles.topModeBtnActive,
                ]}
                onPress={() => setActiveViewMode('form')}>
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={activeViewMode === 'form' ? '#FFFFFF' : '#1E3A8A'}
                />
                <Text
                  style={[
                    styles.topModeBtnText,
                    activeViewMode === 'form' && styles.topModeBtnTextActive,
                  ]}>
                  {editingReportId ? 'Editar mi Reporte' : 'Enviar mi Reporte'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.topModeBtn,
                  activeViewMode === 'reports' && styles.topModeBtnActive,
                ]}
                onPress={() => setActiveViewMode('reports')}>
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={activeViewMode === 'reports' ? '#FFFFFF' : '#1E3A8A'}
                />
                <Text
                  style={[
                    styles.topModeBtnText,
                    activeViewMode === 'reports' && styles.topModeBtnTextActive,
                  ]}>
                  Mis Reportes Individuales ({myIndividualAttendanceReports.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ============================================================== */}
          {/* MODO FORMULARIO: ENVÍO DE REPORTE INDIVIDUAL                   */}
          {/* ============================================================== */}
          {activeViewMode === 'form' ? (
            <View>
              {/* Editing Banner */}
              {editingReportId && (
                <View style={styles.editingBanner}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="pencil" size={16} color="#F59E0B" />
                      <Text style={styles.editingBannerTitle}>Modo Edición de Reporte</Text>
                    </View>
                    <Text style={styles.editingBannerSub}>
                      Modificando reporte para {currentServiceObj.name} ({formatDisplayDate(formServiceDate)})
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.cancelEditBtn} onPress={handleCancelEdit}>
                    <Text style={styles.cancelEditBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.leaderBadgeRow}>
                  <Ionicons name="shield-checkmark" size={14} color="#2563EB" />
                  <Text style={styles.leaderBadgeText}>
                    {currentUser?.role === 'g12_leader' ? 'Líder de 12' : 'Líder G12'}
                  </Text>
                </View>
                <Text style={styles.headerTitle}>
                  {editingReportId ? 'Editar Reporte' : 'Reporte de Asistencia'}
                </Text>
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
                    {leaderInCharge.name} (Cobertura Pastoral)
                  </Text>
                </View>
              </View>

              {/* 1. Service & Date Selection */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>1. Servicio y Fecha a Reportar</Text>
                <Text style={styles.fieldDesc}>Selecciona el servicio al que asistió tu equipo:</Text>
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

                {/* Selector de Fecha del Servicio */}
                <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={15} color="#38BDF8" />
                    <Text style={styles.subSectionTitle}>Fecha del Servicio a Reportar</Text>
                  </View>
                  <Text style={styles.fieldDesc}>
                    ¿A qué día corresponde este reporte de asistencia?
                  </Text>

                  {/* Botones de Selección Rápida */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[
                        styles.quickDateChip,
                        formServiceDate === localTodayStr && styles.quickDateChipActive,
                      ]}
                      onPress={() => setFormServiceDate(localTodayStr)}>
                      <Text
                        style={[
                          styles.quickDateChipText,
                          formServiceDate === localTodayStr && styles.quickDateChipTextActive,
                        ]}>
                        Hoy ({formatDisplayDate(localTodayStr).split(',')[0]})
                      </Text>
                    </TouchableOpacity>

                    {closestSundayStr !== localTodayStr && (
                      <TouchableOpacity
                        style={[
                          styles.quickDateChip,
                          formServiceDate === closestSundayStr && styles.quickDateChipActive,
                        ]}
                        onPress={() => setFormServiceDate(closestSundayStr)}>
                        <Text
                          style={[
                            styles.quickDateChipText,
                            formServiceDate === closestSundayStr && styles.quickDateChipTextActive,
                          ]}>
                          Domingo ({closestSundayStr.split('-').slice(1).reverse().join('/')})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Indicador de Fecha Activa */}
                  <View style={styles.activeDateBanner}>
                    <Ionicons name="time-outline" size={16} color="#38BDF8" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.activeDateBannerSub}>Fecha seleccionada para este reporte:</Text>
                      <Text style={styles.activeDateBannerMain}>
                        {formatDisplayDate(formServiceDate)} ({formServiceDate})
                      </Text>
                    </View>
                  </View>
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
                          {v.gender === 'F' ? 'Mujer' : 'Hombre'} • {v.age ?? '--'} años
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

              {/* Live Summary Box (Desglose en Vivo de Discípulos e Invitados) */}
              <View style={styles.liveSummaryBox}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Ionicons name="analytics" size={17} color="#38BDF8" />
                  <Text style={styles.liveSummaryTitle}>Resumen en Vivo de tu Reporte</Text>
                </View>

                <View style={styles.liveSummaryGrid}>
                  {/* Discípulos */}
                  <View style={styles.liveSummaryCard}>
                    <Text style={[styles.liveSummaryNum, { color: '#38BDF8' }]}>
                      {formDisciplesBreakdown.total}
                    </Text>
                    <Text style={styles.liveSummaryLbl}>Discípulos</Text>
                    <View style={styles.liveSummarySubRow}>
                      <Text style={styles.liveSummarySubText}>👦 {formDisciplesBreakdown.men} H</Text>
                      <Text style={styles.liveSummarySubText}>•</Text>
                      <Text style={styles.liveSummarySubText}>👩 {formDisciplesBreakdown.women} M</Text>
                      {formDisciplesBreakdown.prejuvenil > 0 && (
                        <>
                          <Text style={styles.liveSummarySubText}>•</Text>
                          <Text style={styles.liveSummarySubText}>🎒 {formDisciplesBreakdown.prejuvenil} PJ</Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Invitados */}
                  <View style={styles.liveSummaryCard}>
                    <Text style={[styles.liveSummaryNum, { color: '#F59E0B' }]}>
                      {formVisitorsBreakdown.total}
                    </Text>
                    <Text style={styles.liveSummaryLbl}>Invitados</Text>
                    <View style={styles.liveSummarySubRow}>
                      <Text style={styles.liveSummarySubText}>👦 {formVisitorsBreakdown.men} H</Text>
                      <Text style={styles.liveSummarySubText}>•</Text>
                      <Text style={styles.liveSummarySubText}>👩 {formVisitorsBreakdown.women} M</Text>
                      {formVisitorsBreakdown.prejuvenil > 0 && (
                        <>
                          <Text style={styles.liveSummarySubText}>•</Text>
                          <Text style={styles.liveSummarySubText}>🎒 {formVisitorsBreakdown.prejuvenil} PJ</Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Líder (Tú) */}
                  <View style={styles.liveSummaryCard}>
                    <Text style={[styles.liveSummaryNum, { color: myAttendance ? '#10B981' : '#94A3B8' }]}>
                      {myAttendance ? '1' : '0'}
                    </Text>
                    <Text style={styles.liveSummaryLbl}>Líder (Tú)</Text>
                    <Text style={[styles.liveSummarySubText, { color: myAttendance ? '#10B981' : '#94A3B8' }]}>
                      {myAttendance ? (leaderGender === 'F' ? '👩 Asistes' : '👨 Asistes') : 'Ausente'}
                    </Text>
                  </View>
                </View>

                <View style={styles.liveSummaryTotalBar}>
                  <Text style={styles.liveSummaryTotalLbl}>Total personas que reportas:</Text>
                  <Text style={styles.liveSummaryTotalVal}>{formTotalPeople} personas</Text>
                </View>
              </View>

              {/* Submit / Update Button */}
              <TouchableOpacity
                style={[
                  styles.submitReportBtn,
                  submitting && { opacity: 0.6 },
                  editingReportId ? { backgroundColor: '#D97706' } : {},
                ]}
                onPress={handleSubmitLeaderReport}
                disabled={submitting}
                activeOpacity={0.85}>
                <Ionicons
                  name={editingReportId ? 'checkmark-circle' : 'paper-plane'}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.submitReportBtnText}>
                  {submitting
                    ? 'Guardando...'
                    : editingReportId
                      ? 'Guardar Cambios del Reporte'
                      : 'Enviar Reporte a mi Pastor'}
                </Text>
              </TouchableOpacity>

              {/* Recent Reports History with Edit & Delete */}
              <View style={styles.historyCard}>
                <Text style={styles.historyTitle}>Mis Últimos Reportes Enviados</Text>
                {myLeaderAttendanceReports
                  .filter(
                    (r) =>
                      r.leaderId === currentUser?.id ||
                      (r.leaderName &&
                        currentUser?.firstName &&
                        r.leaderName.toLowerCase().includes(currentUser.firstName.toLowerCase()))
                  )
                  .slice(0, 5)
                  .map((r) => {
                    const rSummary = summarizeReports([r], members);
                    return (
                      <View key={r.id} style={styles.historyItem}>
                        <Ionicons name="checkmark-done-circle" size={20} color="#10B981" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.historyService}>
                            {r.serviceId} • {formatDisplayDate(r.serviceDate)}
                          </Text>
                          <Text style={styles.historyDate}>
                            👥 {rSummary.total} personas • {rSummary.disciplesTotal} discípulos (👦{rSummary.disciplesHombres} 👩{rSummary.disciplesMujeres}) • {rSummary.visitorsTotal} visitas
                          </Text>
                          <Text style={styles.historyRecipient}>
                            📬 Enviado a: {r.recipientLeaderName || leaderInCharge.name}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <TouchableOpacity
                            style={styles.miniActionBtn}
                            onPress={() => handleStartEditReport(r)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="pencil" size={13} color="#38BDF8" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.miniActionBtnDelete}
                            onPress={() => handleDeleteReport(r)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={13} color="#F87171" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
              </View>
            </View>
          ) : isPastor ? (
            /* ============================================================== */
            /* VISTA EXCLUSIVA PARA PASTORES (REPORTES TOTALES Y CONSOLIDADO) */
            /* ============================================================== */
            <View>
              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.leaderBadgeRow, { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderColor: 'rgba(234, 179, 8, 0.4)' }]}>
                  <Ionicons name="ribbon" size={14} color="#FBBF24" />
                  <Text style={[styles.leaderBadgeText, { color: '#FBBF24' }]}>
                    Acceso Pastoral Exclusivo • Reportes Totales
                  </Text>
                </View>
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
                      {d === localTodayStr ? 'Hoy' : formatDisplayDate(d).split(',')[0]} ({d.split('-').slice(1).reverse().join('/')})
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
                          {currentServiceObj.name}
                        </Text>
                        <Text style={styles.totalBannerNumber}>{serviceSummary.total}</Text>
                        <Text style={styles.totalBannerSub}>
                          {serviceSummary.reportsCount} reportes recibidos para este servicio
                        </Text>
                      </View>
                      {isPastor && (
                        <TouchableOpacity
                          style={[
                            styles.saveLiveBtn,
                            isSaved && !hasNewReportsPending && { backgroundColor: '#059669' },
                            isSaved && hasNewReportsPending && { backgroundColor: '#D97706' },
                          ]}
                          onPress={handleSaveConsolidatedAsOfficial}
                          activeOpacity={0.85}>
                          <Ionicons
                            name={
                              isSaved && !hasNewReportsPending
                                ? 'checkmark-done-circle'
                                : isSaved && hasNewReportsPending
                                  ? 'refresh'
                                  : 'cloud-upload'
                            }
                            size={18}
                            color="#FFFFFF"
                          />
                          <Text style={styles.saveLiveBtnText}>
                            {isSaved && !hasNewReportsPending
                              ? 'Guardado'
                              : isSaved && hasNewReportsPending
                                ? 'Actualizar'
                                : 'Guardar'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Stat Chips: Discípulos (H y M), Invitados (H y M), Prejuvenil (<14), Líderes */}
                    <View style={styles.consolidatedBadgesGrid}>
                      {/* Discípulos de la Iglesia */}
                      <View style={[styles.statBoxCard, { backgroundColor: '#DBEAFE', borderLeftColor: '#2563EB' }]}>
                        <View style={styles.statBoxHeader}>
                          <Ionicons name="people" size={17} color="#1E40AF" />
                          <Text style={[styles.statBoxTitle, { color: '#1E40AF' }]}>Discípulos</Text>
                        </View>
                        <Text style={[styles.statBoxNumber, { color: '#1E40AF' }]}>
                          {serviceSummary.disciplesTotal}
                        </Text>
                        <Text style={[styles.statBoxSub, { color: '#1E40AF' }]}>
                          👦 {serviceSummary.disciplesHombres} Hombres • 👩 {serviceSummary.disciplesMujeres} Mujeres
                        </Text>
                      </View>

                      {/* Nuevas Visitas / Invitados */}
                      <View style={[styles.statBoxCard, { backgroundColor: '#FEF3C7', borderLeftColor: '#F59E0B' }]}>
                        <View style={styles.statBoxHeader}>
                          <Ionicons name="sparkles" size={17} color="#B45309" />
                          <Text style={[styles.statBoxTitle, { color: '#B45309' }]}>Nuevas Visitas</Text>
                        </View>
                        <Text style={[styles.statBoxNumber, { color: '#B45309' }]}>
                          {serviceSummary.visitorsTotal}
                        </Text>
                        <Text style={[styles.statBoxSub, { color: '#B45309' }]}>
                          👦 {serviceSummary.visitorsHombres} Hombres • 👩 {serviceSummary.visitorsMujeres} Mujeres
                        </Text>
                      </View>

                      {/* Prejuvenil (<14) */}
                      <View style={[styles.statBoxCard, { backgroundColor: '#EDE9FE', borderLeftColor: '#7C3AED' }]}>
                        <View style={styles.statBoxHeader}>
                          <Ionicons name="school" size={17} color="#6D28D9" />
                          <Text style={[styles.statBoxTitle, { color: '#6D28D9' }]}>Prejuvenil</Text>
                        </View>
                        <Text style={[styles.statBoxNumber, { color: '#6D28D9' }]}>
                          {serviceSummary.prejuvenil}
                        </Text>
                        <Text style={[styles.statBoxSub, { color: '#6D28D9' }]}>Menores de 14 años</Text>
                      </View>

                      {/* Líderes Titulares presentes */}
                      <View style={[styles.statBoxCard, { backgroundColor: '#D1FAE5', borderLeftColor: '#059669' }]}>
                        <View style={styles.statBoxHeader}>
                          <Ionicons name="shield-checkmark" size={17} color="#065F46" />
                          <Text style={[styles.statBoxTitle, { color: '#065F46' }]}>Líderes</Text>
                        </View>
                        <Text style={[styles.statBoxNumber, { color: '#065F46' }]}>
                          {serviceSummary.leadersTotal}
                        </Text>
                        <Text style={[styles.statBoxSub, { color: '#065F46' }]}>
                          👨 {serviceSummary.leadersHombres} • 👩 {serviceSummary.leadersMujeres}
                        </Text>
                      </View>
                    </View>

                    {/* Barra de Totales Globales por Sexo */}
                    <View style={styles.consolidatedSexBar}>
                      <View style={styles.consolidatedSexItem}>
                        <Ionicons name="man" size={14} color="#38BDF8" />
                        <Text style={styles.consolidatedSexText}>
                          Total Hombres: <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>{serviceSummary.hombres}</Text>
                        </Text>
                      </View>
                      <View style={styles.consolidatedSexDivider} />
                      <View style={styles.consolidatedSexItem}>
                        <Ionicons name="woman" size={14} color="#F472B6" />
                        <Text style={styles.consolidatedSexText}>
                          Total Mujeres: <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>{serviceSummary.mujeres}</Text>
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Resumen de Líderes agrupados por Líder 12 */}
                  <View style={styles.reportsSummaryCard}>
                    <Text style={styles.sectionHeading}>
                      Líderes que reportaron para este servicio ({reportsForSelectedService.length})
                    </Text>
                    {reportsForSelectedService.length === 0 ? (
                      <Text style={styles.emptyNoticeText}>
                        Aún no hay reportes de líderes enviados para este servicio en la fecha {selectedDate}.
                      </Text>
                    ) : (
                      groupedAttendanceReports.map((group) => {
                        return (
                          <View key={group.leader12Name} style={styles.consolidadoGroupContainer}>
                            {/* Banner de Líder 12 */}
                            <View style={styles.consolidadoGroupHeader}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <Ionicons name="shield-checkmark" size={16} color="#1E3A8A" />
                                <Text style={styles.consolidadoGroupTitle}>
                                  Líder 12: {group.leader12Name}
                                </Text>
                              </View>
                              <View style={styles.consolidadoGroupBadge}>
                                <Text style={styles.consolidadoGroupBadgeText}>
                                  Total Red: +{group.groupSummary.total}
                                </Text>
                              </View>
                            </View>

                            {/* Filas de líderes dentro del grupo */}
                            {group.reports.map((rep) => {
                              const repSummary = summarizeReports([rep], members);
                              const isL12 = isReportFromLeader12(rep, group.leader12Name);
                              return (
                                <View key={rep.id} style={styles.leaderSummaryRow}>
                                  <View
                                    style={[
                                      styles.leaderSummaryAvatar,
                                      isL12 ? { backgroundColor: '#1E3A8A' } : { backgroundColor: '#059669' },
                                    ]}>
                                    <Text style={styles.leaderSummaryAvatarText}>{rep.leaderName[0]}</Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <Text style={styles.leaderSummaryName}>{rep.leaderName}</Text>
                                      <View
                                        style={[
                                          styles.roleTagPill,
                                          isL12 ? styles.roleTagL12 : styles.roleTag144,
                                        ]}>
                                        <Text
                                          style={[
                                            styles.roleTagPillText,
                                            isL12 ? { color: '#1D4ED8' } : { color: '#15803D' },
                                          ]}>
                                          {isL12 ? 'Líder 12' : 'Discípulo 144'}
                                        </Text>
                                      </View>
                                    </View>
                                    <Text style={styles.leaderSummaryMeta}>
                                      {repSummary.hombres} H • {repSummary.mujeres} M • {repSummary.prejuvenil} P • {repSummary.visitors} Visitas
                                    </Text>
                                  </View>
                                  <View style={styles.leaderSummaryTotalBadge}>
                                    <Text style={styles.leaderSummaryTotalText}>+{repSummary.total}</Text>
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              ) : (
                /* Reportes Detallados Agrupados por Líder 12 */
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
                    groupedAttendanceReports.map((group) => {
                      return (
                        <View key={group.leader12Name} style={styles.leader12GroupCard}>
                          {/* Header del Grupo del Líder 12 */}
                          <View style={styles.leader12GroupHeader}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="shield-checkmark" size={18} color="#1E3A8A" />
                                <Text style={styles.leader12GroupTitle}>
                                  Líder 12: {group.leader12Name}
                                </Text>
                              </View>
                              <Text style={styles.leader12GroupSubtitle}>
                                {group.reports.length === 1
                                  ? '1 reporte recibido'
                                  : `${group.reports.length} reportes vinculados (Líder 12 y células 144)`}
                              </Text>
                            </View>
                            <View style={styles.leader12TotalBadge}>
                              <Text style={styles.leader12TotalBadgeLabel}>Total Red</Text>
                              <Text style={styles.leader12TotalBadgeNumber}>
                                {group.groupSummary.total}
                              </Text>
                            </View>
                          </View>

                          {/* Resumen Consolidado de la Red del Líder 12 */}
                          <View style={styles.groupBreakdownRow}>
                            <View style={styles.groupStatBox}>
                              <Text style={[styles.groupStatVal, { color: '#1D4ED8' }]}>
                                {group.groupSummary.disciplesTotal}
                              </Text>
                              <Text style={styles.groupStatLbl}>Discípulos</Text>
                            </View>
                            <View style={styles.groupStatBox}>
                              <Text style={[styles.groupStatVal, { color: '#D97706' }]}>
                                {group.groupSummary.visitorsTotal}
                              </Text>
                              <Text style={styles.groupStatLbl}>Visitas</Text>
                            </View>
                            <View style={styles.groupStatBox}>
                              <Text style={[styles.groupStatVal, { color: '#2563EB' }]}>
                                {group.groupSummary.hombres}
                              </Text>
                              <Text style={styles.groupStatLbl}>Hombres</Text>
                            </View>
                            <View style={styles.groupStatBox}>
                              <Text style={[styles.groupStatVal, { color: '#DB2777' }]}>
                                {group.groupSummary.mujeres}
                              </Text>
                              <Text style={styles.groupStatLbl}>Mujeres</Text>
                            </View>
                            <View style={styles.groupStatBox}>
                              <Text style={[styles.groupStatVal, { color: '#7C3AED' }]}>
                                {group.groupSummary.prejuvenil}
                              </Text>
                              <Text style={styles.groupStatLbl}>Prejuvenil</Text>
                            </View>
                          </View>

                          {/* Desglose de Cada Reporte (Líder 12 y sus discípulos) */}
                          <View style={styles.groupInnerReportsList}>
                            {group.reports.map((rep) => {
                              const repSummary = summarizeReports([rep], members);
                              const isL12 = isReportFromLeader12(rep, group.leader12Name);
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
                                <View key={rep.id} style={styles.innerReportCard}>
                                  <View style={styles.reportHeader}>
                                    <View style={{ flex: 1 }}>
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <Text style={styles.reportLeaderName}>{rep.leaderName}</Text>
                                        <View
                                          style={[
                                            styles.roleTagPill,
                                            isL12 ? styles.roleTagL12 : styles.roleTag144,
                                          ]}>
                                          <Text
                                            style={[
                                              styles.roleTagPillText,
                                              isL12 ? { color: '#1D4ED8' } : { color: '#15803D' },
                                            ]}>
                                            {isL12 ? '👑 Líder 12 (Titular)' : '🌱 Discípulo (144)'}
                                          </Text>
                                        </View>
                                      </View>

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

                                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
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
                                      <View style={styles.individualContributionBadge}>
                                        <Text style={styles.individualContributionText}>
                                          Aporte: +{repSummary.total}
                                        </Text>
                                      </View>
                                    </View>
                                  </View>

                                  {/* Breakdown Individual con separación clara de discípulos e invitados por sexo */}
                                  <View style={styles.reportBreakdownRow}>
                                    <View style={styles.miniStat}>
                                      <Text style={[styles.miniStatVal, { color: '#1D4ED8' }]}>{repSummary.disciplesTotal}</Text>
                                      <Text style={styles.miniStatLbl}>Discípulos</Text>
                                      <Text style={styles.miniStatSub}>👦{repSummary.disciplesHombres} 👩{repSummary.disciplesMujeres}</Text>
                                    </View>
                                    <View style={styles.miniStat}>
                                      <Text style={[styles.miniStatVal, { color: '#D97706' }]}>{repSummary.visitorsTotal}</Text>
                                      <Text style={styles.miniStatLbl}>Invitados</Text>
                                      <Text style={styles.miniStatSub}>👦{repSummary.visitorsHombres} 👩{repSummary.visitorsMujeres}</Text>
                                    </View>
                                    <View style={styles.miniStat}>
                                      <Text style={[styles.miniStatVal, { color: '#7C3AED' }]}>{repSummary.prejuvenil}</Text>
                                      <Text style={styles.miniStatLbl}>Prejuvenil</Text>
                                      <Text style={styles.miniStatSub}>&lt;14 años</Text>
                                    </View>
                                    <View style={styles.miniStat}>
                                      <Text style={[styles.miniStatVal, { color: '#059669' }]}>{repSummary.total}</Text>
                                      <Text style={styles.miniStatLbl}>Total</Text>
                                      <Text style={styles.miniStatSub}>👦{repSummary.hombres} 👩{repSummary.mujeres}</Text>
                                    </View>
                                  </View>

                                  {/* Disciples Breakdown */}
                                  {rep.disciples.length > 0 && (
                                    <View style={{ marginTop: 10 }}>
                                      <Text style={styles.disciplesHeaderTitle}>
                                        Discípulos Reportados ({rep.disciples.length}):
                                      </Text>
                                      {rep.disciples.map((d: DiscipleAttendanceItem, i: number) => {
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
                                  )}

                                  {/* Visitor Names */}
                                  {rep.visitorNames && rep.visitorNames.length > 0 && (
                                    <View style={styles.visitorsTagRow}>
                                      <Ionicons name="people-circle" size={16} color="#D97706" />
                                      <Text style={styles.visitorsTagText}>
                                        Visitas ({rep.visitorNames.length}): {rep.visitorNames.join(', ')}
                                      </Text>
                                    </View>
                                  )}

                                  {rep.notes && (
                                    <Text style={styles.reportNotes}>
                                      &ldquo;{rep.notes}&rdquo;
                                    </Text>
                                  )}

                                  {/* Acciones para Editar y Eliminar el Reporte */}
                                  {canManageReport(rep) && (
                                    <View style={styles.reportActionRow}>
                                      <TouchableOpacity
                                        style={styles.editReportBtn}
                                        onPress={() => handleStartEditReport(rep)}
                                        activeOpacity={0.75}>
                                        <Ionicons name="create-outline" size={14} color="#2563EB" />
                                        <Text style={styles.editReportBtnText}>Editar Reporte</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={styles.deleteReportBtn}
                                        onPress={() => handleDeleteReport(rep)}
                                        activeOpacity={0.75}>
                                        <Ionicons name="trash-outline" size={14} color="#DC2626" />
                                        <Text style={styles.deleteReportBtnText}>Eliminar</Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              );
                            })}
                          </View>

                          {/* Footer con el Total Consolidado de la Red */}
                          {group.reports.length > 1 && (
                            <View style={styles.groupFooterBar}>
                              <Ionicons name="people" size={16} color="#1E3A8A" />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.groupFooterText}>
                                  Total Red {group.leader12Name}:{' '}
                                  <Text style={{ fontWeight: '800', color: '#1E3A8A' }}>
                                    {group.groupSummary.total} personas únicas
                                  </Text>
                                </Text>
                                <Text style={styles.groupFooterSubtext}>
                                  Conteo consolidado exacto sin duplicar discípulos que también reportaron su célula.
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              )}
            </View>
          ) : (
            /* ============================================================== */
            /* VISTA DE NO-PASTORES: MIS REPORTES INDIVIDUALES               */
            /* ============================================================== */
            <View>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.leaderBadgeRow}>
                  <Ionicons name="person" size={14} color="#38BDF8" />
                  <Text style={styles.leaderBadgeText}>Reportes Individuales</Text>
                </View>
                <Text style={styles.headerTitle}>Mis Reportes de Asistencia</Text>
                <Text style={styles.headerSubtitle}>
                  Historial y detalle de los reportes individuales que has enviado personalmente
                </Text>
              </View>

              {/* Banner de Acceso Restringido Pastoral */}
              <View style={styles.pastoralLockNoticeCard}>
                <Ionicons name="lock-closed" size={20} color="#FBBF24" />
                <Text style={styles.pastoralLockNoticeText}>
                  <Text style={{ fontWeight: '800', color: '#FBBF24' }}>Acceso Pastoral Exclusivo: </Text>
                  Los reportes totales y el conteo consolidado de toda la iglesia son de acceso exclusivo para los Pastores. Aquí puedes consultar y gestionar tus reportes individuales.
                </Text>
              </View>

              {myIndividualAttendanceReports.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                    <Ionicons name="document-text-outline" size={38} color="#38BDF8" />
                  </View>
                  <Text style={styles.emptyTitle}>Sin reportes individuales enviados</Text>
                  <Text style={styles.emptySubtitle}>
                    Aún no has registrado ningún reporte de asistencia individual. Presiona el botón de abajo para enviar el primero.
                  </Text>
                  <TouchableOpacity
                    style={[styles.saveLiveBtn, { alignSelf: 'center', marginTop: 14 }]}
                    onPress={() => setActiveViewMode('form')}>
                    <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.saveLiveBtnText}>Enviar mi Primer Reporte</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 14 }}>
                  {myIndividualAttendanceReports.map((rep) => {
                    const rSummary = summarizeReports([rep], members);
                    return (
                      <View key={rep.id} style={styles.innerReportCard}>
                        {/* Cabecera del Reporte Individual */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.reportLeaderName}>
                              {rep.serviceId}
                            </Text>
                            <Text style={styles.reportServiceDateText}>
                              📅 {formatDisplayDate(rep.serviceDate)} ({rep.serviceDate})
                            </Text>
                          </View>
                          <View style={styles.individualContributionBadge}>
                            <Text style={styles.individualContributionText}>
                              +{rSummary.total} personas
                            </Text>
                          </View>
                        </View>

                        {/* Desglose de Asistencia */}
                        <View style={styles.groupBreakdownRow}>
                          <View style={styles.groupStatBox}>
                            <Text style={[styles.groupStatVal, { color: '#38BDF8' }]}>
                              {rep.myAttendance ? '1' : '0'}
                            </Text>
                            <Text style={styles.groupStatLbl}>Titular</Text>
                          </View>
                          <View style={styles.groupStatBox}>
                            <Text style={[styles.groupStatVal, { color: '#34D399' }]}>
                              {rSummary.disciplesTotal}
                            </Text>
                            <Text style={styles.groupStatLbl}>Discípulos</Text>
                          </View>
                          <View style={styles.groupStatBox}>
                            <Text style={[styles.groupStatVal, { color: '#F472B6' }]}>
                              {rSummary.visitorsTotal}
                            </Text>
                            <Text style={styles.groupStatLbl}>Visitas</Text>
                          </View>
                        </View>

                        {/* Destinatario */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 8 }}>
                          <Ionicons name="paper-plane-outline" size={13} color="#94A3B8" />
                          <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                            Enviado a:{' '}
                            <Text style={{ fontWeight: '700', color: '#F1F5F9' }}>
                              {rep.recipientLeaderName || leaderInCharge.name}
                            </Text>
                          </Text>
                        </View>

                        {/* Discípulos detallados */}
                        {rep.disciples && rep.disciples.length > 0 && (
                          <View style={{ marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#CBD5E1', marginBottom: 4 }}>
                              Discípulos Reportados ({rep.disciples.length}):
                            </Text>
                            <View style={{ gap: 4 }}>
                              {rep.disciples.map((d, dIdx) => (
                                <View key={d.memberId || dIdx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Ionicons
                                    name={d.attended ? 'checkmark-circle' : 'close-circle'}
                                    size={14}
                                    color={d.attended ? '#10B981' : '#64748B'}
                                  />
                                  <Text style={{ fontSize: 12, color: d.attended ? '#FFFFFF' : '#64748B' }}>
                                    {d.name} ({d.gender === 'F' ? 'Mujer' : 'Hombre'} • {d.age} años)
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Visitas detalladas */}
                        {rep.visitors && rep.visitors.length > 0 && (
                          <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)' }}>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#CBD5E1', marginBottom: 4 }}>
                              Invitados / Visitas ({rep.visitors.length}):
                            </Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                              {rep.visitors.map((v, vIdx) => (
                                <View key={v.id || vIdx} style={styles.visitorPill}>
                                  <Ionicons name="sparkles" size={11} color="#FBBF24" />
                                  <Text style={styles.visitorPillText}>
                                    {v.name} ({v.gender === 'F' ? 'F' : 'M'}, {v.age}a)
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Notas */}
                        {rep.notes ? (
                          <View style={{ marginTop: 8, backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 8, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#94A3B8' }}>
                              📝 {rep.notes}
                            </Text>
                          </View>
                        ) : null}

                        {/* Botones de Acción */}
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.06)' }}>
                          <TouchableOpacity
                            style={styles.editReportBtn}
                            onPress={() => handleStartEditReport(rep)}
                            activeOpacity={0.75}>
                            <Ionicons name="pencil-outline" size={13} color="#38BDF8" />
                            <Text style={styles.editReportBtnText}>Editar Reporte</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteReportBtn}
                            onPress={() => handleDeleteReport(rep)}
                            activeOpacity={0.75}>
                            <Ionicons name="trash-outline" size={13} color="#DC2626" />
                            <Text style={styles.deleteReportBtnText}>Eliminar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
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
    backgroundColor: '#080C16',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  topNavTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  topNavSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    marginBottom: 16,
  },
  leaderBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  leaderBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
    lineHeight: 18,
  },
  recipientNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  pastoralLockNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  pastoralLockNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#FDE68A',
    lineHeight: 18,
  },
  emptyContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  reportServiceDateText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  visitorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  visitorPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FDE68A',
  },
  recipientNoticeTitle: {
    fontSize: 11,
    color: '#93C5FD',
    fontWeight: '700',
  },
  recipientNoticeName: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 1,
  },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fieldDesc: {
    fontSize: 12,
    color: '#94A3B8',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  serviceChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  serviceChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  serviceChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderColor: '#38BDF8',
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  dateChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
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
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  smallLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  genderChipActiveM: {
    backgroundColor: '#0284C7',
  },
  genderChipActiveF: {
    backgroundColor: '#DB2777',
  },
  genderChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  genderChipTextActive: {
    color: '#FFFFFF',
  },
  ageInput: {
    width: 48,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  prejuvenilBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  prejuvenilBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C084FC',
  },
  disciplesList: {
    gap: 10,
    marginTop: 6,
  },
  discipleCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
  },
  discipleCardAttended: {
    borderColor: 'rgba(56, 189, 248, 0.4)',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
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
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discipleAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#38BDF8',
  },
  discipleName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  discipleStatus: {
    fontSize: 11,
    color: '#94A3B8',
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
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  personMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  genderChipTextSm: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  personMetaAgeInput: {
    width: 44,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  personMetaHint: {
    fontSize: 10,
    fontWeight: '700',
    color: '#C084FC',
    marginLeft: 8,
    flex: 1,
  },
  noDisciplesNotice: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
  },
  noDisciplesText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  addDiscipleBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  addSectionSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 6,
  },
  textInputSm: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ageInputSm: {
    width: 50,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addBtnSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284C7',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  visitorIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  visitorCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  visitorCardMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  addVisitorBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  textInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: '#FFFFFF',
  },
  submitReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  submitReportBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  historyCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  historyService: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historyDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  historyRecipient: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  segmentTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  totalBannerCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
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
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  totalBannerNumber: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -1,
  },
  totalBannerSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  saveLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  emptyNotice: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
  },
  emptyNoticeText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  leaderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  leaderSummaryAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderSummaryAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#38BDF8',
  },
  leaderSummaryName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaderSummaryMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  leaderSummaryTotalBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  leaderSummaryTotalText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
  },
  reportsListSection: {
    gap: 12,
  },
  reportCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reportLeaderName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  reportMeta: {
    fontSize: 11,
    color: '#94A3B8',
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
    color: '#38BDF8',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
    color: '#FFFFFF',
  },
  miniStatLbl: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  disciplesHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
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
    color: '#FFFFFF',
    flex: 1,
  },
  discipleRepTag: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
  },
  visitorsTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 8,
  },
  visitorsTagText: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: '600',
  },
  reportNotes: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  fromProfileHint: {
    fontSize: 11,
    color: '#34D399',
    fontWeight: '700',
    marginTop: 6,
  },
  fromProfileMissingHint: {
    fontSize: 11,
    color: '#FBBF24',
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
    color: '#FFFFFF',
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  batchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  adjustPill: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Selector de Modo Superior para Líderes 12
  topModeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  topModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  topModeBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  topModeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  topModeBtnTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },

  // Grupo en Tab Consolidado
  consolidadoGroupContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  consolidadoGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  consolidadoGroupTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  consolidadoGroupBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  consolidadoGroupBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // Role Tag Pills (Líder 12 vs 144)
  roleTagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleTagL12: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  roleTag144: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  roleTagPillText: {
    fontSize: 10,
    fontWeight: '700',
  },

  // Contenedor Principal de Grupo por Líder 12 en Tab Reportes
  leader12GroupCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  leader12GroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  leader12GroupTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  leader12GroupSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  leader12TotalBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
  },
  leader12TotalBadgeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#93C5FD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  leader12TotalBadgeNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Barra de Conteo Consolidado del Grupo
  groupBreakdownRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  groupStatBox: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  groupStatVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  groupStatLbl: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 1,
  },

  // Lista interna de reportes
  groupInnerReportsList: {
    padding: 12,
    gap: 12,
  },
  innerReportCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 1,
  },
  individualContributionBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  individualContributionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },

  // Footer con el Total Consolidado
  groupFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(56, 189, 248, 0.3)',
  },
  groupFooterText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  groupFooterSubtext: {
    fontSize: 11,
    color: '#93C5FD',
    marginTop: 2,
  },

  // Banner de Modo Edición
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1.5,
    borderColor: '#EAB308',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  editingBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FACC15',
  },
  editingBannerSub: {
    fontSize: 11,
    color: '#FEF08A',
    marginTop: 2,
  },
  cancelEditBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },

  // Sub Section Title
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Quick Date Chips
  quickDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickDateChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  quickDateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  quickDateChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Active Date Banner
  activeDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  activeDateBannerMain: {
    fontSize: 12,
    color: '#E0F2FE',
  },
  activeDateBannerSub: {
    fontSize: 10,
    color: '#93C5FD',
    marginTop: 1,
  },

  // Live Summary Box (preview before sending)
  liveSummaryBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  liveSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  liveSummaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  liveSummaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
  },
  liveSummaryNum: {
    fontSize: 18,
    fontWeight: '900',
  },
  liveSummaryLbl: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 2,
  },
  liveSummarySubRow: {
    marginTop: 4,
  },
  liveSummarySubText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  liveSummaryTotalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  liveSummaryTotalLbl: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  liveSummaryTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#22C55E',
  },

  // Consolidated Sex Bar
  consolidatedSexBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  consolidatedSexItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  consolidatedSexText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  consolidatedSexDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 16,
  },

  // Mini Stat Subtitle
  miniStatSub: {
    fontSize: 8.5,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Report Action Row
  reportActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  editReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editReportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#60A5FA',
  },
  deleteReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteReportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },

  // Mini Action Buttons (for recent reports cards)
  miniActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniActionBtnDelete: {
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    borderColor: '#EF4444',
  },
});
