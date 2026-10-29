import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DoodleBackground } from '@/components/doodle-background';
import { useChurch } from '@/context/ChurchContext';
import { EventCard } from '@/components/event-card';
import {
  EVENT_TYPE_META,
  EVENT_TYPES,
  formatEventDate,
  fromISODate,
  getMonthCalendarGrid,
  MONTH_NAMES,
  normalizeEventType,
  relativeDayLabel,
  sortEventsAsc,
  todayISO,
  WEEKDAY_SHORT_LABELS,
} from '@/lib/events';
import { ChurchEvent, ChurchEventType } from '@/types/church';

export default function EventsListScreen() {
  const router = useRouter();
  const {
    getVisibleEvents,
    canManageEvents,
    currentUser,
    getUserCoordinatedMinistries,
  } = useChurch();

  // Eventos filtrados por red: jóvenes no le salen a la red adulta, solo a pastores principales
  const visibleEvents = useMemo(() => {
    return getVisibleEvents(currentUser);
  }, [getVisibleEvents, currentUser]);

  const today = todayISO();
  const todayDateObj = fromISODate(today);

  // Modo de vista: Lista o Calendario mensual
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');

  // Estado del calendario mensual
  const [calYear, setCalYear] = useState<number>(todayDateObj.getFullYear());
  const [calMonth, setCalMonth] = useState<number>(todayDateObj.getMonth()); // 0-11
  const [selectedDate, setSelectedDate] = useState<string>(today);

  // Filtros de vista de lista
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [typeFilter, setTypeFilter] = useState<ChurchEventType | 'all'>('all');

  // Clasificación de eventos filtrados
  const { upcoming, past, eventsByDate } = useMemo(() => {
    const t = todayISO();
    const sorted = sortEventsAsc(visibleEvents);
    const byDate: Record<string, ChurchEvent[]> = {};
    for (const ev of sorted) {
      if (!byDate[ev.date]) byDate[ev.date] = [];
      byDate[ev.date].push(ev);
    }
    return {
      upcoming: sorted.filter((e) => e.date >= t),
      past: sorted.filter((e) => e.date < t).reverse(),
      eventsByDate: byDate,
    };
  }, [visibleEvents]);

  const myCoordinatedUpcoming = useMemo(() => {
    if (!currentUser) return [];
    return upcoming.filter((ev) => {
      const coordinated = getUserCoordinatedMinistries(ev.id, currentUser);
      return coordinated.length > 0;
    });
  }, [upcoming, currentUser, getUserCoordinatedMinistries]);

  // Eventos para la vista de lista filtrada
  const list = (scope === 'upcoming' ? upcoming : past).filter(
    (e) => typeFilter === 'all' || normalizeEventType(e.type) === typeFilter
  );

  // Cuadrícula de días para el mes actual
  const calendarDays = useMemo(
    () => getMonthCalendarGrid(calYear, calMonth),
    [calYear, calMonth]
  );

  // Semanas del mes (cada fila tiene exactamente 7 días: Dom a Sáb)
  const calendarWeeks = useMemo(() => {
    const weeks: (typeof calendarDays)[] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);

  // Eventos para el día seleccionado en el calendario
  const selectedDayEvents = eventsByDate[selectedDate] ?? [];

  // Navegación de mes
  const goToPrevMonth = () => {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setCalYear(todayDateObj.getFullYear());
    setCalMonth(todayDateObj.getMonth());
    setSelectedDate(today);
  };

  const isCurrentMonthViewing =
    calYear === todayDateObj.getFullYear() && calMonth === todayDateObj.getMonth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style="light" />
      <DoodleBackground>
        <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        {/* HERO HEADER GLASS */}
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.95)', 'rgba(30, 58, 138, 0.38)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <Text style={styles.heroKicker}>
            {canManageEvents ? 'PLANEADOR PASTORAL' : 'CRONOGRAMA DE LA IGLESIA'}
          </Text>
          <Text style={styles.heroTitle}>Servicios & Eventos</Text>
          <Text style={styles.heroSubtitle}>
            {canManageEvents
              ? 'Organiza el orden del servicio dominical y el cronograma de actividades.'
              : 'Consulta el orden y los horarios de cada servicio y evento.'}
          </Text>

          {/* ACCIONES RÁPIDAS PARA PASTORES */}
          {canManageEvents && (
            <View style={styles.createRow}>
              <TouchableOpacity
                style={styles.createPrimary}
                activeOpacity={0.85}
                onPress={() => router.push('/planner/editor?type=servicio' as any)}>
                <View style={styles.createIcon}>
                  <Ionicons name="sunny" size={20} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.createPrimaryTitle}>+ Servicio</Text>
                  <Text style={styles.createPrimarySub}>Orden de servicio</Text>
                </View>
                <Ionicons name="add-circle" size={22} color="#38BDF8" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createSecondary}
                activeOpacity={0.85}
                onPress={() =>
                  router.push(
                    `/planner/editor?type=evento${selectedDate ? `&date=${selectedDate}` : ''}` as any
                  )
                }>
                <View style={styles.createSecondaryIcon}>
                  <Ionicons name="calendar" size={18} color="#C4B5FD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.createSecondaryTitle}>+ Evento</Text>
                  <Text style={styles.createSecondarySub}>Actividad especial</Text>
                </View>
                <Ionicons name="add-circle" size={22} color="#A78BFA" />
              </TouchableOpacity>
            </View>
          )}

          {/* ACCESO A MINISTERIOS */}
          <TouchableOpacity
            style={styles.ministryPlannerPill}
            onPress={() => router.push('/ministries' as any)}
            activeOpacity={0.85}>
            <Ionicons name="ribbon" size={15} color="#38BDF8" />
            <Text style={styles.ministryPlannerPillText}>
              Ministerios & Coordinadores (Alabanza, Medios, Protocolo)
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#38BDF8" />
          </TouchableOpacity>

          {/* AVISO DE COORDINACIÓN PARA NO-PASTORES */}
          {!canManageEvents && myCoordinatedUpcoming.length > 0 && (
            <TouchableOpacity
              style={styles.coordPlannerBanner}
              activeOpacity={0.85}
              onPress={() => router.push(`/planner/${myCoordinatedUpcoming[0].id}` as any)}>
              <View style={styles.coordPlannerDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.coordPlannerTitle}>
                  ¡Tienes servicios asignados para coordinar!
                </Text>
                <Text style={styles.coordPlannerSub}>
                  {myCoordinatedUpcoming[0].title} · {formatEventDate(myCoordinatedUpcoming[0].date)}
                </Text>
              </View>
              <Text style={styles.coordPlannerAction}>Entrar →</Text>
            </TouchableOpacity>
          )}

          {/* TOGGLE VISTA: LISTA VS CALENDARIO */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'calendar' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('calendar')}>
              <Ionicons
                name="calendar"
                size={16}
                color={viewMode === 'calendar' ? '#FFFFFF' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.viewToggleText,
                  viewMode === 'calendar' && styles.viewToggleTextActive,
                ]}>
                Calendario
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}>
              <Ionicons
                name="list"
                size={16}
                color={viewMode === 'list' ? '#FFFFFF' : '#94A3B8'}
              />
              <Text
                style={[
                  styles.viewToggleText,
                  viewMode === 'list' && styles.viewToggleTextActive,
                ]}>
                Lista ({upcoming.length})
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* CONTENIDO SEGÚN MODO DE VISTA */}
        {viewMode === 'calendar' ? (
          /* ============================================================ */
          /* MODO CALENDARIO MENSUAL                                      */
          /* ============================================================ */
          <View style={styles.calendarContainer}>
            {/* CABECERA DEL MES Y NAVEGACIÓN */}
            <View style={styles.monthHeaderCard}>
              <View style={styles.monthNavRow}>
                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={goToPrevMonth}
                  accessibilityLabel="Mes anterior">
                  <Ionicons name="chevron-back" size={20} color="#38BDF8" />
                </TouchableOpacity>

                <View style={styles.monthTitleWrapper}>
                  <Text style={styles.monthTitle}>
                    {MONTH_NAMES[calMonth]} {calYear}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.monthNavBtn}
                  onPress={goToNextMonth}
                  accessibilityLabel="Mes siguiente">
                  <Ionicons name="chevron-forward" size={20} color="#38BDF8" />
                </TouchableOpacity>
              </View>

              {!isCurrentMonthViewing && (
                <TouchableOpacity style={styles.todayPill} onPress={goToToday}>
                  <Ionicons name="today-outline" size={13} color="#38BDF8" />
                  <Text style={styles.todayPillText}>Ir al mes actual</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* CUADRÍCULA DEL CALENDARIO */}
            <View style={styles.calendarCard}>
              {/* DÍAS DE LA SEMANA */}
              <View style={styles.weekdaysHeader}>
                {WEEKDAY_SHORT_LABELS.map((label, idx) => (
                  <View key={label} style={styles.weekdayCell}>
                    <Text style={[styles.weekdayLabel, idx === 0 && styles.weekdaySunday]}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* DÍAS DEL MES POR SEMANAS (DOM A SÁB) */}
              <View style={styles.daysContainer}>
                {calendarWeeks.map((week, wIdx) => (
                  <View key={wIdx} style={styles.weekRow}>
                    {week.map((item) => {
                      const dayEvents = eventsByDate[item.date] ?? [];
                      const isSelected = item.date === selectedDate;
                      const hasServices = dayEvents.some((e: ChurchEvent) => normalizeEventType(e.type) === 'servicio');
                      const hasEvents = dayEvents.some((e: ChurchEvent) => normalizeEventType(e.type) === 'evento');

                      return (
                        <TouchableOpacity
                          key={item.date}
                          activeOpacity={0.7}
                          style={[
                            styles.dayCell,
                            isSelected && styles.dayCellSelected,
                            item.isToday && !isSelected && styles.dayCellToday,
                          ]}
                          onPress={() => setSelectedDate(item.date)}>
                          <Text
                            style={[
                              styles.dayCellText,
                              !item.isCurrentMonth && styles.dayCellMuted,
                              item.isSunday && item.isCurrentMonth && !isSelected && styles.dayCellSundayText,
                              item.isToday && !isSelected && styles.dayCellTodayText,
                              isSelected && styles.dayCellSelectedText,
                            ]}>
                            {item.dayNumber}
                          </Text>

                          {/* PUNTOS INDICADORES DE SERVICIOS / EVENTOS */}
                          <View style={styles.dotsRow}>
                            {hasServices && (
                              <View
                                style={[
                                  styles.eventDot,
                                  { backgroundColor: isSelected ? '#FFFFFF' : '#2563EB' },
                                ]}
                              />
                            )}
                            {hasEvents && (
                              <View
                                style={[
                                  styles.eventDot,
                                  { backgroundColor: isSelected ? '#E9D5FF' : '#7C3AED' },
                                ]}
                              />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              {/* LEYENDA DEL CALENDARIO */}
              <View style={styles.calendarLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                  <Text style={styles.legendText}>Servicio</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#7C3AED' }]} />
                  <Text style={styles.legendText}>Evento</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.legendTodayRing} />
                  <Text style={styles.legendText}>Hoy</Text>
                </View>
              </View>
            </View>

            {/* SECCIÓN DEL DÍA SELECCIONADO */}
            <View style={styles.selectedDayHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.selectedDayTitle}>
                    {formatEventDate(selectedDate)}
                  </Text>
                  {relativeDayLabel(selectedDate) && (
                    <View style={styles.relativeBadge}>
                      <Text style={styles.relativeBadgeText}>
                        {relativeDayLabel(selectedDate)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.selectedDayCount}>
                  {selectedDayEvents.length === 0
                    ? 'Sin actividades programadas'
                    : `${selectedDayEvents.length} actividad${selectedDayEvents.length > 1 ? 'es' : ''}`}
                </Text>
              </View>

              {canManageEvents && (
                <TouchableOpacity
                  style={styles.addForDayBtn}
                  onPress={() => router.push(`/planner/editor?date=${selectedDate}` as any)}>
                  <Ionicons name="add" size={16} color="#38BDF8" />
                  <Text style={styles.addForDayText}>Programar</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* LISTA DE ACTIVIDADES PARA EL DÍA SELECCIONADO */}
            <View style={styles.selectedDayList}>
              {selectedDayEvents.length === 0 ? (
                <View style={styles.emptyDayCard}>
                  <Ionicons name="calendar-outline" size={36} color="#94A3B8" />
                  <Text style={styles.emptyDayTitle}>Día sin actividades</Text>
                  <Text style={styles.emptyDaySub}>
                    No hay ningún servicio ni evento programado para esta fecha.
                  </Text>
                  {canManageEvents && (
                    <TouchableOpacity
                      style={styles.emptyDayAddBtn}
                      onPress={() => router.push(`/planner/editor?date=${selectedDate}` as any)}>
                      <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.emptyDayAddBtnText}>Crear evento o servicio</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                selectedDayEvents.map((ev: ChurchEvent) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onPress={() => router.push(`/planner/${ev.id}` as any)}
                  />
                ))
              )}
            </View>
          </View>
        ) : (
          /* ============================================================ */
          /* MODO LISTA                                                   */
          /* ============================================================ */
          <View>
            {/* SEGMENTO PRÓXIMOS VS ANTERIORES */}
            <View style={styles.segment}>
              {(['upcoming', 'past'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.segmentBtn, scope === s && styles.segmentBtnActive]}
                  onPress={() => setScope(s)}>
                  <Text style={[styles.segmentText, scope === s && styles.segmentTextActive]}>
                    {s === 'upcoming' ? `Próximos (${upcoming.length})` : `Anteriores (${past.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* FILTROS DE CATEGORÍA: TODOS | SERVICIO | EVENTO */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, typeFilter === 'all' && styles.filterChipActive]}
                onPress={() => setTypeFilter('all')}>
                <Text style={[styles.filterText, typeFilter === 'all' && styles.filterTextActive]}>
                  Todos
                </Text>
              </TouchableOpacity>
              {EVENT_TYPES.map((t) => {
                const meta = EVENT_TYPE_META[t];
                const active = typeFilter === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.filterChip,
                      active && { backgroundColor: meta.color, borderColor: meta.color },
                    ]}
                    onPress={() => setTypeFilter(t)}>
                    <Ionicons
                      name={meta.icon as keyof typeof Ionicons.glyphMap}
                      size={13}
                      color={active ? '#FFFFFF' : meta.color}
                    />
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>
                      {meta.label}s
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* LISTA */}
            <View style={styles.list}>
              {list.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="calendar-clear-outline" size={40} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>
                    {scope === 'upcoming' ? 'No hay eventos programados' : 'Sin eventos anteriores'}
                  </Text>
                  {canManageEvents && scope === 'upcoming' && (
                    <Text style={styles.emptySub}>
                      Toca “+ Servicio” o “+ Evento” arriba para crear una actividad.
                    </Text>
                  )}
                </View>
              ) : (
                list.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onPress={() => router.push(`/planner/${ev.id}` as any)}
                  />
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
      </DoodleBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070A14' },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroKicker: { color: '#38BDF8', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '800', marginTop: 4, letterSpacing: -0.5 },
  heroSubtitle: { color: '#94A3B8', fontSize: 13, marginTop: 4, lineHeight: 19 },

  // Botones de creación rápida
  createRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  createPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(2, 132, 199, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  createIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPrimaryTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  createPrimarySub: { color: '#38BDF8', fontSize: 11, fontWeight: '600', marginTop: 1 },

  createSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.35)',
    borderRadius: 16,
    padding: 12,
  },
  createSecondaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createSecondaryTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  createSecondarySub: { color: '#C4B5FD', fontSize: 11, fontWeight: '600', marginTop: 1 },

  // Botón de acceso a Ministerios
  ministryPlannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  ministryPlannerPillText: {
    flex: 1,
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
  },

  // Banner para coordinadores no pastores
  coordPlannerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(167, 139, 250, 0.35)',
  },
  coordPlannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A78BFA',
  },
  coordPlannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F5F3FF',
  },
  coordPlannerSub: {
    fontSize: 11,
    color: '#C4B5FD',
    marginTop: 1,
  },
  coordPlannerAction: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A78BFA',
  },

  // Toggle de vistas
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 12,
    padding: 3,
    marginTop: 18,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  viewToggleBtnActive: {
    backgroundColor: '#0284C7',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  viewToggleText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  viewToggleTextActive: { color: '#FFFFFF' },

  // ==========================================
  // ESTILOS DEL CALENDARIO
  // ==========================================
  calendarContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  monthHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },

  // Tarjeta de la cuadrícula
  calendarCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 2,
  },
  weekdaysHeader: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  weekdaySunday: {
    color: '#38BDF8',
  },
  daysContainer: {
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dayCell: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 4,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  dayCellSelected: {
    backgroundColor: '#0284C7',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  dayCellMuted: {
    color: 'rgba(255, 255, 255, 0.2)',
    fontWeight: '500',
  },
  dayCellSundayText: {
    color: '#38BDF8',
  },
  dayCellTodayText: {
    color: '#38BDF8',
    fontWeight: '900',
  },
  dayCellSelectedText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
    height: 5,
    alignItems: 'center',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  // Leyenda
  calendarLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendTodayRing: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // Cabecera del día seleccionado
  selectedDayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  selectedDayTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  relativeBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  relativeBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  selectedDayCount: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 2,
  },
  addForDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  addForDayText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedDayList: {
    gap: 10,
  },
  emptyDayCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  emptyDayTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  emptyDaySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 3,
    lineHeight: 16,
  },
  emptyDayAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 14,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyDayAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // ==========================================
  // ESTILOS DE LA VISTA DE LISTA
  // ==========================================
  segment: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: '#0284C7' },
  segmentText: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  segmentTextActive: { color: '#FFFFFF' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 14,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderColor: '#38BDF8',
  },
  filterText: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  filterTextActive: { color: '#38BDF8', fontWeight: '800' },

  list: { paddingHorizontal: 16, gap: 12 },
  empty: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#94A3B8', marginTop: 4, textAlign: 'center' },
});
