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

export interface AttendanceSummary {
  hombres: number;
  mujeres: number;
  prejuvenil: number;
  sinClasificar: number;
  total: number;
  visitors: number;
  reportsCount: number;
}

export const emptySummary = (): AttendanceSummary => ({
  hombres: 0,
  mujeres: 0,
  prejuvenil: 0,
  sinClasificar: 0,
  total: 0,
  visitors: 0,
  reportsCount: 0,
});

const isRealMemberId = (id?: string) => !!id && !id.startsWith('disc-') && !id.startsWith('lider-');

const normalizePersonName = (name?: string) =>
  name ? name.toLowerCase().trim().replace(/\s+/g, ' ') : '';

/**
 * Suma la asistencia de varios reportes de líderes.
 * - Cuenta al líder (si asistió), a sus discípulos presentes y a sus invitados.
 * - Si una misma persona (por ID de miembro o por nombre normalizado) aparece en dos reportes del mismo servicio,
 *   se cuenta una sola vez (ej: un discípulo que reportó su propio líder 12 y también envía su propio reporte).
 */
export function summarizeReports(
  reports: LeaderAttendanceReport[],
  members: Member[] = []
): AttendanceSummary {
  const summary = emptySummary();
  const counted = new Set<string>();
  const memberById = new Map(members.map((m) => [m.id, m]));

  const add = (cat: AttendanceCategory, isVisitor = false) => {
    if (cat === 'hombres') summary.hombres++;
    else if (cat === 'mujeres') summary.mujeres++;
    else if (cat === 'prejuvenil') summary.prejuvenil++;
    else summary.sinClasificar++;
    summary.total++;
    if (isVisitor) summary.visitors++;
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
        add(classifyPerson(rep.leaderGender ?? m?.gender, rep.leaderAge ?? calcAge(m?.birthDate)));
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
        add(classifyPerson(d.gender ?? m?.gender, d.age ?? calcAge(m?.birthDate)));
      });

    // 3. Invitados
    const visitorList = rep.visitors ?? [];
    visitorList.forEach((v) => add(classifyPerson(v.gender, v.age), true));
    const extraVisitors = Math.max(
      0,
      (rep.visitorsCount || 0) - Math.max(visitorList.length, 0)
    );
    for (let i = 0; i < extraVisitors; i++) add('sin_clasificar', true);
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
