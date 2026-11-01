import {
  AttendanceCategory,
  ChurchServiceSchedule,
  LeaderAttendanceReport,
  Member,
  PersonGender,
} from '@/types/church';

/** Edad límite (exclusiva) para contar a una persona como Prejuvenil. */
export const PREJUVENIL_MAX_AGE = 14;

export const CATEGORY_META: Record<
  AttendanceCategory,
  { label: string; short: string; color: string; bg: string; icon: string }
> = {
  hombres: { label: 'Hombres', short: 'H', color: '#2563EB', bg: '#DBEAFE', icon: 'man' },
  mujeres: { label: 'Mujeres', short: 'M', color: '#DB2777', bg: '#FCE7F3', icon: 'woman' },
  prejuvenil: {
    label: 'Prejuvenil',
    short: 'PJ',
    color: '#7C3AED',
    bg: '#EDE9FE',
    icon: 'school',
  },
  sin_clasificar: {
    label: 'Sin clasificar',
    short: '?',
    color: '#64748B',
    bg: '#F1F5F9',
    icon: 'help-circle',
  },
};

export function calcAge(birthDate?: string): number | undefined {
  if (!birthDate) return undefined;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : undefined;
}

/** Menor de 14 años => Prejuvenil (sin importar el sexo). Si no, se clasifica por sexo. */
export function classifyPerson(gender?: PersonGender, age?: number): AttendanceCategory {
  if (typeof age === 'number' && age < PREJUVENIL_MAX_AGE) return 'prejuvenil';
  if (gender === 'M') return 'hombres';
  if (gender === 'F') return 'mujeres';
  return 'sin_clasificar';
}

export function parseAge(text: string): number | undefined {
  const n = parseInt(text.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  const dayName = DAY_NAMES_ES[d.getDay()] || '';
  const monthName = MONTH_NAMES_ES[month] || '';
  return `${dayName}, ${day} de ${monthName}`;
}

export interface AttendanceSummary {
  // Totales generales
  total: number;
  hombres: number; // >= 14 años (Líderes + Discípulos + Visitas)
  mujeres: number; // >= 14 años (Líderes + Discípulas + Visitas)
  prejuvenil: number; // < 14 años (todos)
  sinClasificar: number;

  // 1. Discípulos (Miembros que asistieron)
  disciplesTotal: number;
  disciplesHombres: number;
  disciplesMujeres: number;
  disciplesPrejuvenil: number;

  // 2. Invitados (Nuevos)
  visitorsTotal: number;
  visitorsHombres: number;
  visitorsMujeres: number;
  visitorsPrejuvenil: number;
  visitors: number; // alias para compatibilidad

  // 3. Líderes que reportaron su propia asistencia
  leadersTotal: number;
  leadersHombres: number;
  leadersMujeres: number;

  reportsCount: number;
}

export const emptySummary = (): AttendanceSummary => ({
  total: 0,
  hombres: 0,
  mujeres: 0,
  prejuvenil: 0,
  sinClasificar: 0,

  disciplesTotal: 0,
  disciplesHombres: 0,
  disciplesMujeres: 0,
  disciplesPrejuvenil: 0,

  visitorsTotal: 0,
  visitorsHombres: 0,
  visitorsMujeres: 0,
  visitorsPrejuvenil: 0,
  visitors: 0,

  leadersTotal: 0,
  leadersHombres: 0,
  leadersMujeres: 0,

  reportsCount: 0,
});

const isRealMemberId = (id?: string) => !!id && !id.startsWith('disc-') && !id.startsWith('lider-');

const normalizePersonName = (name?: string) =>
  name ? name.toLowerCase().trim().replace(/\s+/g, ' ') : '';

/**
 * Suma la asistencia de varios reportes de líderes.
 * - Cuenta al líder (si asistió), a sus discípulos presentes y a sus invitados.
 * - Discípulos e invitados se desglosan por sexo (Hombres y Mujeres) por separado para evitar confusiones.
 * - Si una misma persona aparece en dos reportes del mismo servicio, se deduplica para no inflar los números.
 */
export function summarizeReports(
  reports: LeaderAttendanceReport[],
  members: Member[] = []
): AttendanceSummary {
  const summary = emptySummary();
  const counted = new Set<string>();
  const memberById = new Map(members.map((m) => [m.id, m]));

  const addPerson = (
    cat: AttendanceCategory,
    type: 'leader' | 'disciple' | 'visitor'
  ) => {
    // Totales generales
    if (cat === 'hombres') summary.hombres++;
    else if (cat === 'mujeres') summary.mujeres++;
    else if (cat === 'prejuvenil') summary.prejuvenil++;
    else summary.sinClasificar++;
    summary.total++;

    // Desglose por tipo
    if (type === 'leader') {
      summary.leadersTotal++;
      if (cat === 'hombres') summary.leadersHombres++;
      else if (cat === 'mujeres') summary.leadersMujeres++;
    } else if (type === 'disciple') {
      summary.disciplesTotal++;
      if (cat === 'hombres') summary.disciplesHombres++;
      else if (cat === 'mujeres') summary.disciplesMujeres++;
      else if (cat === 'prejuvenil') summary.disciplesPrejuvenil++;
    } else if (type === 'visitor') {
      summary.visitorsTotal++;
      summary.visitors++;
      if (cat === 'hombres') summary.visitorsHombres++;
      else if (cat === 'mujeres') summary.visitorsMujeres++;
      else if (cat === 'prejuvenil') summary.visitorsPrejuvenil++;
    }
  };

  reports.forEach((rep) => {
    summary.reportsCount++;
    const scope = `${rep.serviceId}|${rep.serviceDate}`;

    // 1. Líder
    if (rep.myAttendance) {
      const normLeader = normalizePersonName(rep.leaderName);
      const keyId = isRealMemberId(rep.leaderId) ? `${scope}|id:${rep.leaderId}` : null;
      const keyName = normLeader ? `${scope}|name:${normLeader}` : `${scope}|r${rep.id}`;

      const alreadyCounted =
        (keyId && counted.has(keyId)) || (normLeader && counted.has(keyName));

      if (!alreadyCounted) {
        if (keyId) counted.add(keyId);
        if (normLeader) counted.add(keyName);
        const m =
          memberById.get(rep.leaderId) ||
          members.find(
            (mem) => normalizePersonName(`${mem.firstName} ${mem.lastName}`) === normLeader
          );
        addPerson(
          classifyPerson(rep.leaderGender ?? m?.gender, rep.leaderAge ?? calcAge(m?.birthDate)),
          'leader'
        );
      }
    }

    // 2. Discípulos presentes
    rep.disciples
      .filter((d) => d.attended)
      .forEach((d, idx) => {
        const normDName = normalizePersonName(d.name);
        const keyId = isRealMemberId(d.memberId) ? `${scope}|id:${d.memberId}` : null;
        const keyName = normDName ? `${scope}|name:${normDName}` : `${scope}|r${rep.id}|d${idx}`;

        const alreadyCounted =
          (keyId && counted.has(keyId)) || (normDName && counted.has(keyName));
        if (alreadyCounted) return;

        if (keyId) counted.add(keyId);
        if (normDName) counted.add(keyName);
        const m =
          memberById.get(d.memberId) ||
          members.find(
            (mem) => normalizePersonName(`${mem.firstName} ${mem.lastName}`) === normDName
          );
        addPerson(classifyPerson(d.gender ?? m?.gender, d.age ?? calcAge(m?.birthDate)), 'disciple');
      });

    // 3. Invitados
    const visitorList = rep.visitors ?? [];
    visitorList.forEach((v) => addPerson(classifyPerson(v.gender, v.age), 'visitor'));
    const extraVisitors = Math.max(
      0,
      (rep.visitorsCount || 0) - Math.max(visitorList.length, 0)
    );
    for (let i = 0; i < extraVisitors; i++) addPerson('sin_clasificar', 'visitor');
  });

  return summary;
}

/** Fecha (YYYY-MM-DD) más reciente con reportes. */
export function latestReportDate(reports: LeaderAttendanceReport[]): string | undefined {
  return reports.reduce<string | undefined>(
    (acc, r) => (!acc || r.serviceDate > acc ? r.serviceDate : acc),
    undefined
  );
}

export function uniqueReportDates(reports: LeaderAttendanceReport[]): string[] {
  return Array.from(new Set(reports.map((r) => r.serviceDate))).sort((a, b) =>
    b.localeCompare(a)
  );
}

export function serviceName(services: ChurchServiceSchedule[], id: string): string {
  return services.find((s) => s.id === id)?.name ?? id;
}
