import { ChurchEvent, ChurchEventType, ServiceScheduleItem } from '@/types/church';

export const EVENT_TYPE_META: Record<
  ChurchEventType,
  { label: string; icon: string; color: string; soft: string }
> = {
  servicio: { label: 'Servicio', icon: 'sunny', color: '#2563EB', soft: '#DBEAFE' },
  evento: { label: 'Evento', icon: 'calendar', color: '#7C3AED', soft: '#EDE9FE' },
};

export const EVENT_TYPES: ChurchEventType[] = ['servicio', 'evento'];

export function normalizeEventType(type?: string): ChurchEventType {
  if (type === 'servicio' || type === 'servicio_domingo') return 'servicio';
  return 'evento';
}

export const ITEM_TYPE_META: Record<
  ServiceScheduleItem['type'],
  { label: string; color: string; icon: string }
> = {
  welcome: { label: 'Bienvenida', color: '#F59E0B', icon: 'hand-left' },
  worship: { label: 'Alabanza', color: '#8B5CF6', icon: 'musical-notes' },
  offering: { label: 'Ofrendas', color: '#10B981', icon: 'gift' },
  preaching: { label: 'Palabra', color: '#2563EB', icon: 'book' },
  communion: { label: 'Ministración', color: '#DC2626', icon: 'heart' },
  announcements: { label: 'Anuncios', color: '#0EA5E9', icon: 'megaphone' },
  other: { label: 'Otro', color: '#64748B', icon: 'ellipsis-horizontal' },
};

export const ITEM_TYPES = Object.keys(ITEM_TYPE_META) as ServiceScheduleItem['type'][];

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
export const WEEKDAY_SHORT_LABELS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

export function localId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

export const todayISO = () => toISODate(new Date());

/** Próxima fecha (incluye hoy) para el día de semana dado (0 = domingo). */
export function nextWeekdayISO(weekday: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

export function addDaysISO(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatEventDate(iso: string, opts: { short?: boolean } = {}): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = fromISODate(iso);
  const wd = WEEKDAYS[d.getDay()];
  if (opts.short) return `${wd.slice(0, 3)} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
  return `${wd} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[fromISODate(iso).getDay()].slice(0, 3).toUpperCase();
}

export function relativeDayLabel(iso: string): string | undefined {
  const today = todayISO();
  if (iso === today) return 'Hoy';
  if (iso === addDaysISO(today, 1)) return 'Mañana';
  return undefined;
}

/** '9:00 AM' | '19:30' -> minutos desde medianoche. */
export function parseTime(text: string): number | undefined {
  const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([aApP][mM])?$/);
  if (!m) return undefined;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toUpperCase();
  if (min > 59 || h > 23) return undefined;
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

export function formatTime(totalMinutes: number): string {
  const mins = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Recalcula la hora de cada bloque a partir de la hora de inicio y las duraciones. */
export function recalcScheduleTimes(
  startTime: string,
  items: ServiceScheduleItem[]
): ServiceScheduleItem[] {
  let cursor = parseTime(startTime);
  if (cursor === undefined) return items.map((it, i) => ({ ...it, order: i + 1 }));
  return items.map((it, i) => {
    const updated = { ...it, order: i + 1, time: formatTime(cursor as number) };
    cursor = (cursor as number) + (Number(it.durationMinutes) || 0);
    return updated;
  });
}

export function scheduleEndTime(ev: Pick<ChurchEvent, 'time' | 'schedule'>): string | undefined {
  const start = parseTime(ev.time);
  if (start === undefined || ev.schedule.length === 0) return undefined;
  const total = ev.schedule.reduce((acc, it) => acc + (Number(it.durationMinutes) || 0), 0);
  return formatTime(start + total);
}

type TemplateItem = Pick<ServiceScheduleItem, 'title' | 'durationMinutes' | 'type' | 'responsible'>;

const TEMPLATES: Record<ChurchEventType, TemplateItem[]> = {
  servicio: [
    { title: 'Bienvenida', durationMinutes: 10, type: 'welcome', responsible: '' },
    { title: 'Alabanza & Adoración', durationMinutes: 25, type: 'worship', responsible: 'Voz Profetica' },
    { title: 'Mensaje de la Palabra', durationMinutes: 45, type: 'preaching', responsible: '' },
    { title: 'Ministración & Llamado', durationMinutes: 15, type: 'communion', responsible: '' },
    { title: 'Diezmos & Ofrendas', durationMinutes: 10, type: 'offering', responsible: '' },
    { title: 'Despedida', durationMinutes: 10, type: 'other', responsible: '' },
  ],
  evento: [
    { title: 'Recepción & Bienvenida', durationMinutes: 15, type: 'welcome', responsible: '' },
    { title: 'Alabanza & Adoración', durationMinutes: 25, type: 'worship', responsible: 'Voz Profetica' },
    { title: 'Tema Central / Ministración', durationMinutes: 45, type: 'preaching', responsible: '' },
    { title: 'Tiempo de Compartir & Despedida', durationMinutes: 20, type: 'other', responsible: '' },
  ],
};

export function buildTemplate(type: ChurchEventType, startTime: string): ServiceScheduleItem[] {
  const normType = normalizeEventType(type);
  const base = TEMPLATES[normType];
  return recalcScheduleTimes(
    startTime,
    base.map((t, i) => ({ ...t, id: localId('sch'), order: i + 1, time: '' }))
  );
}

export function sortEventsAsc(events: ChurchEvent[]): ChurchEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (parseTime(a.time) ?? 0) - (parseTime(b.time) ?? 0);
  });
}

// ==========================================
// CALENDARIO MENSUAL: MODELO Y UTILIDADES
// ==========================================
export interface CalendarDayItem {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSunday: boolean;
}

/**
 * Genera la cuadrícula de días para el calendario mensual (domingo a sábado).
 * month: 0-11
 */
export function getMonthCalendarGrid(year: number, month: number): CalendarDayItem[] {
  const today = todayISO();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDay.getDay(); // 0 = Domingo
  const totalDays = lastDay.getDate();

  const days: CalendarDayItem[] = [];

  // Días previos de relleno del mes anterior
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const prevDayNum = prevMonthLastDay - i;
    const prevDate = new Date(year, month - 1, prevDayNum);
    const dateStr = toISODate(prevDate);
    days.push({
      date: dateStr,
      dayNumber: prevDayNum,
      isCurrentMonth: false,
      isToday: dateStr === today,
      isSunday: prevDate.getDay() === 0,
    });
  }

  // Días del mes actual
  for (let d = 1; d <= totalDays; d++) {
    const currDate = new Date(year, month, d);
    const dateStr = toISODate(currDate);
    days.push({
      date: dateStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateStr === today,
      isSunday: currDate.getDay() === 0,
    });
  }

  // Días posteriores de relleno para completar las semanas (múltiplo de 7)
  const remainingDays = (7 - (days.length % 7)) % 7;
  for (let j = 1; j <= remainingDays; j++) {
    const nextDate = new Date(year, month + 1, j);
    const dateStr = toISODate(nextDate);
    days.push({
      date: dateStr,
      dayNumber: j,
      isCurrentMonth: false,
      isToday: dateStr === today,
      isSunday: nextDate.getDay() === 0,
    });
  }

  return days;
}
