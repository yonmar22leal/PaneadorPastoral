import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Kid,
  KidClassroom,
  Member,
  AttendanceRecord,
  ChurchEvent,
  AuthUser,
  ChurchNetwork,
  ChurchServiceSlotId,
  ChurchServiceSchedule,
  CellGroup,
  LeaderAttendanceReport,
  CellMeetingReport,
  MemberRole,
  Ministry,
  EventMinistryAssignment,
  ServiceScheduleItem,
  VolunteerRoster,
  PastoralPost,
  PrayerRequest,
  PrayerStatus,
  PrayerCategory,
  Marriage,
  LadderPerson,
  LadderStage,
  LadderStatus,
} from '../types/church';
import {
  churchServicesSchedule,
  mockClassrooms,
  defaultMinistries,
} from '../data/mockChurchData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { todayISO } from '../lib/events';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const STORAGE_CURRENT_USER = '@planeador_current_user_v1';
const STORAGE_MINISTRIES = '@planeador_ministries_v1';
const STORAGE_PASTORAL_POSTS = '@planeador_pastoral_posts_v1';
const STORAGE_PRAYER_REQUESTS = '@planeador_prayer_requests_v1';
const STORAGE_MARRIAGES = '@planeador_marriages_v1';
const STORAGE_LADDER = '@planeador_ladder_v1';
const STORAGE_MEMBER_BIRTHDAYS = '@planeador_member_birthdays_v1';
const CHURCH_ID = '11111111-1111-1111-1111-111111111111';

const cleanDateForStorage = (dStr?: string): string | undefined => {
  if (!dStr) return undefined;
  const t = dStr.trim();
  if (!t) return undefined;
  const dmy = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return t.replace(/\//g, '-');
};

const saveBirthdayLocally = async (memberId: string, bDate?: string) => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_MEMBER_BIRTHDAYS);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    const cleaned = cleanDateForStorage(bDate);
    if (cleaned) {
      map[memberId] = cleaned;
    } else {
      delete map[memberId];
    }
    await AsyncStorage.setItem(STORAGE_MEMBER_BIRTHDAYS, JSON.stringify(map));
  } catch (err) {
    console.warn('Error guardando cumpleaños en cache:', err);
  }
};

const VALID_DB_SERVICE_IDS = [
  'domingo_11am',
  'domingo_adultos_1',
  'domingo_juvenil',
  'domingo_adultos_2',
  'viernes_adoracion',
];

const sanitizeServiceId = (serviceId?: string | null): string | null => {
  if (!serviceId) return null;
  if (VALID_DB_SERVICE_IDS.includes(serviceId)) return serviceId;
  return null;
};

const defaultPrayerRequests: PrayerRequest[] = [
  {
    id: 'pr-1',
    memberId: 'demo-1',
    memberName: 'Hermana Carmen Gómez',
    memberPhone: '+58 412-5550192',
    category: 'salud',
    title: 'Recuperación de cirugía de mi madre',
    description: 'Pido oración por mi mamá Rosa, fue operada de la vesícula y pedimos al Señor pronta recuperación y fortaleza.',
    isPrivateForPastors: false,
    status: 'praying',
    prayingPastors: ['Pastor Josué Rodríguez', 'Pastora Norelis de Rodríguez'],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'pr-2',
    memberId: 'demo-2',
    memberName: 'Carlos Mendoza',
    memberPhone: '+58 414-9988776',
    category: 'finanzas',
    title: 'Nueva oportunidad laboral y provisión',
    description: 'Estoy en proceso de entrevistas para un nuevo empleo. Pido respaldo en oración a los pastores.',
    isPrivateForPastors: true,
    status: 'pending',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

const defaultPastoralPosts: PastoralPost[] = [
  {
    id: 'post-1',
    authorId: 'pastor-josue-id',
    authorName: 'Pastor Josué Rodríguez',
    authorRole: 'senior_pastor',
    authorNetwork: 'general',
    network: 'general',
    title: 'Nuestra confianza inquebrantable en el Señor',
    content:
      'Amada congregación, en cada temporada recordemos que Dios tiene planes de paz, bienestar y esperanza para cada familia. Permanezcamos firmes en oración, guardando nuestro corazón y apoyando a nuestras células.',
    verse: {
      reference: 'Jeremías 29:11',
      text: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal, para daros el fin que esperáis.',
      translation: 'RVR1960',
    },
    likes: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'post-2',
    authorId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    authorName: 'Pastor Josué Rodríguez',
    authorRole: 'senior_pastor',
    authorNetwork: 'general',
    network: 'general',
    title: '¡Conquisten con fe y valentía!',
    content:
      'Líderes y amada congregación, ningún desafío es demasiado grande cuando caminamos en el poder del Espíritu Santo. ¡Este domingo nos vemos a las 11:00 AM con expectativa de gloria!',
    verse: {
      reference: 'Filipenses 4:13',
      text: 'Todo lo puedo en Cristo que me fortalece.',
      translation: 'RVR1960',
    },
    likes: [],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

const nowQuarterISO = (daysAgo: number) =>
  new Date(Date.now() - 86400000 * daysAgo).toISOString();

const defaultLadderPeople: LadderPerson[] = [
  // Líder 1: Carlos Mendoza (ganó 5: 2 pasaron a consolidar, 1 a discipular, 1 en pausa, 1 se fue)
  {
    id: 'lad-demo-1',
    leaderId: 'demo-leader-carlos',
    leaderName: 'Carlos Mendoza',
    name: 'Andrés Pérez',
    age: 19,
    phone: '+58 412-5550101',
    stage: 'consolidar',
    status: 'active',
    notes: 'Asistiendo fielmente a la célula de los jueves.',
    history: [
      { stage: 'ganar', date: nowQuarterISO(25) },
      { stage: 'consolidar', date: nowQuarterISO(12) },
    ],
    createdAt: nowQuarterISO(25),
    updatedAt: nowQuarterISO(12),
  },
  {
    id: 'lad-demo-2',
    leaderId: 'demo-leader-carlos',
    leaderName: 'Carlos Mendoza',
    name: 'María Fernanda Gómez',
    age: 17,
    phone: '+58 414-5550202',
    stage: 'consolidar',
    status: 'active',
    notes: 'Completó la semana 2 de consolidación.',
    history: [
      { stage: 'ganar', date: nowQuarterISO(22) },
      { stage: 'consolidar', date: nowQuarterISO(9) },
    ],
    createdAt: nowQuarterISO(22),
    updatedAt: nowQuarterISO(9),
  },
  {
    id: 'lad-demo-3',
    leaderId: 'demo-leader-carlos',
    leaderName: 'Carlos Mendoza',
    name: 'José Gregorio Rivas',
    age: 21,
    phone: '+58 424-5550303',
    stage: 'discipular',
    status: 'active',
    notes: 'Cursando nivel 1 de discipulado juvenil.',
    history: [
      { stage: 'ganar', date: nowQuarterISO(35) },
      { stage: 'consolidar', date: nowQuarterISO(20) },
      { stage: 'discipular', date: nowQuarterISO(5) },
    ],
    createdAt: nowQuarterISO(35),
    updatedAt: nowQuarterISO(5),
  },
  {
    id: 'lad-demo-4',
    leaderId: 'demo-leader-carlos',
    leaderName: 'Carlos Mendoza',
    name: 'Luis Ramírez',
    age: 18,
    phone: '+58 412-5550404',
    stage: 'ganar',
    status: 'paused',
    notes: 'De viaje por estudios universitarios este mes.',
    history: [{ stage: 'ganar', date: nowQuarterISO(18) }],
    statusChangedAt: nowQuarterISO(6),
    createdAt: nowQuarterISO(18),
    updatedAt: nowQuarterISO(6),
  },
  {
    id: 'lad-demo-5',
    leaderId: 'demo-leader-carlos',
    leaderName: 'Carlos Mendoza',
    name: 'Diego Torres',
    age: 16,
    phone: '+58 416-5550505',
    stage: 'ganar',
    status: 'lost',
    notes: 'Se mudó de zona y dejó de asistir.',
    history: [{ stage: 'ganar', date: nowQuarterISO(28) }],
    statusChangedAt: nowQuarterISO(10),
    createdAt: nowQuarterISO(28),
    updatedAt: nowQuarterISO(10),
  },

  // Líder 2: Daniela Morales (ganó 4: 1 en ganar, 1 en discipular, 1 enviado, 1 se fue)
  {
    id: 'lad-demo-6',
    leaderId: 'demo-leader-daniela',
    leaderName: 'Daniela Morales',
    name: 'Valentina Herrera',
    age: 20,
    phone: '+58 414-5550606',
    stage: 'enviar',
    status: 'active',
    notes: 'Lista para abrir nueva célula juvenil.',
    history: [
      { stage: 'ganar', date: nowQuarterISO(40) },
      { stage: 'consolidar', date: nowQuarterISO(28) },
      { stage: 'discipular', date: nowQuarterISO(14) },
      { stage: 'enviar', date: nowQuarterISO(3) },
    ],
    createdAt: nowQuarterISO(40),
    updatedAt: nowQuarterISO(3),
  },
  {
    id: 'lad-demo-7',
    leaderId: 'demo-leader-daniela',
    leaderName: 'Daniela Morales',
    name: 'Camila Salazar',
    age: 15,
    phone: '+58 412-5550707',
    stage: 'ganar',
    status: 'active',
    notes: 'Visitó por primera vez el viernes de adoración.',
    history: [{ stage: 'ganar', date: nowQuarterISO(4) }],
    createdAt: nowQuarterISO(4),
    updatedAt: nowQuarterISO(4),
  },
  {
    id: 'lad-demo-8',
    leaderId: 'demo-leader-daniela',
    leaderName: 'Daniela Morales',
    name: 'Gabriela Pinto',
    age: 18,
    phone: '+58 424-5550808',
    stage: 'discipular',
    status: 'active',
    notes: 'Sirviendo como apoyo en bienvenida.',
    history: [
      { stage: 'ganar', date: nowQuarterISO(30) },
      { stage: 'consolidar', date: nowQuarterISO(18) },
      { stage: 'discipular', date: nowQuarterISO(7) },
    ],
    createdAt: nowQuarterISO(30),
    updatedAt: nowQuarterISO(7),
  },
  {
    id: 'lad-demo-9',
    leaderId: 'demo-leader-daniela',
    leaderName: 'Daniela Morales',
    name: 'Sofía Castillo',
    age: 17,
    stage: 'ganar',
    status: 'lost',
    notes: 'No contestó más las llamadas de seguimiento.',
    history: [{ stage: 'ganar', date: nowQuarterISO(21) }],
    statusChangedAt: nowQuarterISO(8),
    createdAt: nowQuarterISO(21),
    updatedAt: nowQuarterISO(8),
  },

  // Líder 3: Gabriel Silva (ganó 3: 2 en ganar, 1 en consolidar)
  {
    id: 'lad-demo-10',
    leaderId: 'demo-leader-gabriel',
    leaderName: 'Gabriel Silva',
    name: 'Samuel Quintero',
    age: 22,
    phone: '+58 412-5550909',
    stage: 'ganar',
    status: 'active',
    notes: 'Invitado del servicio juvenil del domingo.',
    history: [{ stage: 'ganar', date: nowQuarterISO(3) }],
    createdAt: nowQuarterISO(3),
    updatedAt: nowQuarterISO(3),
  },
  {
    id: 'lad-demo-11',
    leaderId: 'demo-leader-gabriel',
    leaderName: 'Gabriel Silva',
    name: 'Sebastián Delgado',
    age: 19,
    phone: '+58 414-5551010',
    stage: 'consolidar',
    status: 'active',
    notes: 'Ya recibió primera visita de consolidación.',
    history: [
      { stage: 'ganar', date: nowQuarterISO(16) },
      { stage: 'consolidar', date: nowQuarterISO(6) },
    ],
    createdAt: nowQuarterISO(16),
    updatedAt: nowQuarterISO(6),
  },
  {
    id: 'lad-demo-12',
    leaderId: 'demo-leader-gabriel',
    leaderName: 'Gabriel Silva',
    name: 'Mateo Villalobos',
    age: 16,
    phone: '+58 424-5551111',
    stage: 'ganar',
    status: 'active',
    notes: 'Asistió a célula por primera vez.',
    history: [{ stage: 'ganar', date: nowQuarterISO(2) }],
    createdAt: nowQuarterISO(2),
    updatedAt: nowQuarterISO(2),
  },
];

export type ChurchEventInput = Omit<ChurchEvent, 'id' | 'createdAt'> & { id?: string };

export type RegisterMemberResult = {
  success: boolean;
  error?: string;
  member?: Member;
};

export type UpdateProfileData = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: 'M' | 'F';
  birthDate?: string;
  familyName?: string;
  preferredService?: ChurchServiceSlotId;
  notes?: string;
  password?: string;
  network?: ChurchNetwork;
  leaderId?: string;
  leaderName?: string;
  avatarUrl?: string;
};

function eventFromRow(item: any): ChurchEvent {
  return {
    id: item.id,
    type: item.event_type || 'servicio',
    title: item.title,
    date: item.event_date,
    time: item.time_start || '',
    location: item.location || undefined,
    network: item.network || 'general',
    serviceSlotId: item.service_id || undefined,
    theme: item.theme || undefined,
    preacher: item.preacher || undefined,
    worshipLeader: item.worship_leader || undefined,
    description: item.description || undefined,
    schedule: Array.isArray(item.schedule) ? item.schedule : [],
    volunteers: Array.isArray(item.volunteers) ? item.volunteers : [],
    ministries: Array.isArray(item.ministries)
      ? item.ministries
      : Array.isArray(item.ministry_assignments)
      ? item.ministry_assignments
      : [],
    createdById: item.created_by_id || undefined,
    createdByName: item.created_by_name || undefined,
    createdAt: item.created_at,
    updatedAt: item.updated_at || undefined,
  };
}

function eventToRow(ev: ChurchEvent) {
  return {
    id: ev.id,
    church_id: CHURCH_ID,
    event_type: ev.type,
    title: ev.title,
    event_date: ev.date,
    time_start: ev.time,
    location: ev.location || null,
    network: ev.network,
    service_id: ev.serviceSlotId || null,
    theme: ev.theme || null,
    preacher: ev.preacher || null,
    worship_leader: ev.worshipLeader || null,
    description: ev.description || null,
    schedule: ev.schedule,
    volunteers: ev.volunteers,
    ministries: ev.ministries || [],
    created_by_id: ev.createdById || null,
    created_by_name: ev.createdByName || null,
    created_at: ev.createdAt,
    updated_at: ev.updatedAt || ev.createdAt,
  };
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

interface ChurchContextType {
  // Auth state
  currentUser: AuthUser | null;
  login: (email: string, password?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  quickDemoLogin: (type: string) => Promise<void>;

  // Data state (directo de base de datos)
  kids: Kid[];
  classrooms: KidClassroom[];
  members: Member[];
  ministries: Ministry[];
  attendanceRecords: AttendanceRecord[];
  events: ChurchEvent[];
  getVisibleEvents: (user?: AuthUser | null) => ChurchEvent[];
  canManageEvents: boolean;
  canUserEditFullEvent: (eventOrId?: ChurchEvent | string | null, user?: AuthUser | null) => boolean;
  servicesSchedule: ChurchServiceSchedule[];
  cellGroups: CellGroup[];
  leaderAttendanceReports: LeaderAttendanceReport[];
  cellMeetingReports: CellMeetingReport[];
  pastoralPosts: PastoralPost[];
  addPastoralPost: (post: Omit<PastoralPost, 'id' | 'likes' | 'createdAt'>) => Promise<string>;
  toggleLikePost: (postId: string) => Promise<void>;
  deletePastoralPost: (postId: string) => Promise<void>;

  // Peticiones de Oración & Cuidado Pastoral
  prayerRequests: PrayerRequest[];
  addPrayerRequest: (req: Omit<PrayerRequest, 'id' | 'createdAt' | 'status' | 'prayingPastors'>) => Promise<string>;
  updatePrayerRequestStatus: (id: string, status: PrayerStatus, pastorName?: string) => Promise<void>;
  togglePrayerSupport: (prayerId: string) => Promise<void>;
  deletePrayerRequest: (id: string) => Promise<void>;

  // Matrimonios & Cobertura Pastoral
  marriages: Marriage[];
  addMarriage: (marriage: Omit<Marriage, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateMarriage: (id: string, data: Partial<Marriage>) => Promise<void>;
  deleteMarriage: (id: string) => Promise<void>;

  // Escalera del Éxito
  ladderPeople: LadderPerson[];
  addLadderPerson: (data: {
    name: string;
    age?: number;
    phone?: string;
    notes?: string;
    stage?: LadderStage;
  }) => Promise<void>;
  moveLadderPerson: (id: string, stage: LadderStage) => Promise<void>;
  setLadderPersonStatus: (id: string, status: LadderStatus) => Promise<void>;
  updateLadderPerson: (
    id: string,
    data: Partial<Pick<LadderPerson, 'name' | 'age' | 'phone' | 'notes'>>
  ) => Promise<void>;
  deleteLadderPerson: (id: string) => Promise<void>;

  isLoading: boolean;
  refreshData: () => Promise<void>;

  // G12 & Network Helpers
  getLeadersByNetwork: (network?: ChurchNetwork) => Member[];
  getDisciplesOfLeader: (leaderId: string) => Member[];
  getMyCellGroups: () => CellGroup[];
  getMyDisciples: () => Member[];
  getMyCellMeetingReports: () => CellMeetingReport[];
  getMyLeaderAttendanceReports: () => LeaderAttendanceReport[];
  getLeaderInCharge: (user?: AuthUser | null) => { id: string; name: string };

  // Ministries Helpers & Actions
  addMinistry: (ministry: Omit<Ministry, 'id' | 'createdAt'>) => Promise<string>;
  updateMinistry: (ministryId: string, data: Partial<Ministry>) => Promise<void>;
  deleteMinistry: (ministryId: string) => Promise<void>;
  assignMemberToMinistry: (memberId: string, ministryName: string) => Promise<void>;
  removeMemberFromMinistry: (memberId: string, ministryName: string) => Promise<void>;
  deletePastEvents: () => Promise<number>;
  getUserCoordinatedMinistries: (eventId: string, user?: AuthUser | null) => EventMinistryAssignment[];
  canUserEditEventPart: (
    eventId: string,
    user?: AuthUser | null
  ) => {
    canEditAll: boolean;
    canEditPart: boolean;
    coordinatedMinistries: EventMinistryAssignment[];
  };
  updateEventMinistryData: (
    eventId: string,
    ministryId: string,
    scheduleItems: ServiceScheduleItem[],
    volunteers: VolunteerRoster[],
    notes?: string
  ) => Promise<void>;

  // Actions
  checkInKid: (kidId: string) => string;
  checkOutKid: (kidId: string) => boolean;
  addKid: (kid: Omit<Kid, 'id' | 'isCheckedIn'>) => Promise<void>;
  addMember: (member: Omit<Member, 'id'>) => Promise<void>;
  registerMember: (
    member: Omit<Member, 'id'> & { autoLogin?: boolean }
  ) => Promise<RegisterMemberResult>;
  saveAttendance: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  toggleVolunteerConfirmation: (eventId: string, volunteerId: string) => Promise<void>;
  saveEvent: (event: ChurchEventInput) => Promise<string>;
  deleteEvent: (eventId: string) => Promise<void>;
  addCellGroup: (cell: Omit<CellGroup, 'id'>) => Promise<void>;
  submitLeaderReport: (report: Omit<LeaderAttendanceReport, 'id' | 'createdAt'>) => Promise<void>;
  updateLeaderReport: (
    reportId: string,
    data: Partial<LeaderAttendanceReport>
  ) => Promise<void>;
  deleteLeaderReport: (reportId: string) => Promise<void>;
  addCellMeetingReport: (report: Omit<CellMeetingReport, 'id' | 'createdAt'>) => Promise<void>;
  updateUserProfile: (
    data: UpdateProfileData
  ) => Promise<{ success: boolean; error?: string }>;
  updateMember: (memberId: string, data: Partial<Member>) => Promise<void>;
  updateMembersBatch: (memberIds: string[], data: Partial<Member>) => Promise<void>;
}

const ChurchContext = createContext<ChurchContextType | undefined>(undefined);

export const ChurchProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Todo inicia vacío: la única fuente es la base de datos Supabase
  const [kids, setKids] = useState<Kid[]>([]);
  const [classrooms, setClassrooms] = useState<KidClassroom[]>(mockClassrooms);
  const [members, setMembers] = useState<Member[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>(defaultMinistries);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [servicesSchedule] = useState<ChurchServiceSchedule[]>(churchServicesSchedule);
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [leaderAttendanceReports, setLeaderAttendanceReports] = useState<LeaderAttendanceReport[]>([]);
  const [cellMeetingReports, setCellMeetingReports] = useState<CellMeetingReport[]>([]);
  const [pastoralPosts, setPastoralPosts] = useState<PastoralPost[]>(defaultPastoralPosts);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>(defaultPrayerRequests);
  const [marriages, setMarriages] = useState<Marriage[]>([]);
  const [ladderPeople, setLadderPeople] = useState<LadderPerson[]>(defaultLadderPeople);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 1. CARGA DE SESIÓN DE USUARIO, MINISTERIOS Y MENSAJES PASTORALES DESDE ASYNCSTORAGE
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedUser = await AsyncStorage.getItem(STORAGE_CURRENT_USER);
        if (storedUser) {
          const parsedUser: AuthUser = JSON.parse(storedUser);
          if (parsedUser && parsedUser.id) {
            setCurrentUser(parsedUser);
          }
        }

        const storedMin = await AsyncStorage.getItem(STORAGE_MINISTRIES);
        if (storedMin) {
          const parsedMin = JSON.parse(storedMin);
          if (Array.isArray(parsedMin) && parsedMin.length > 0) {
            const enriched = parsedMin.map((m: Ministry) => {
              const def = defaultMinistries.find(
                (d) => d.id === m.id || d.name.toLowerCase() === m.name.toLowerCase()
              );
              return {
                ...m,
                defaultRoles:
                  m.defaultRoles && m.defaultRoles.length > 0
                    ? m.defaultRoles
                    : (def?.defaultRoles || []),
              };
            });
            setMinistries(enriched);
          }
        }

        const storedPosts = await AsyncStorage.getItem(STORAGE_PASTORAL_POSTS);
        if (storedPosts) {
          const parsedPosts = JSON.parse(storedPosts);
          if (Array.isArray(parsedPosts) && parsedPosts.length > 0) {
            setPastoralPosts(parsedPosts);
          }
        }

        const storedPrayers = await AsyncStorage.getItem(STORAGE_PRAYER_REQUESTS);
        if (storedPrayers) {
          const parsedPrayers = JSON.parse(storedPrayers);
          if (Array.isArray(parsedPrayers) && parsedPrayers.length > 0) {
            setPrayerRequests(parsedPrayers);
          }
        }

        const storedMarriages = await AsyncStorage.getItem(STORAGE_MARRIAGES);
        if (storedMarriages) {
          const parsedMarriages = JSON.parse(storedMarriages);
          if (Array.isArray(parsedMarriages) && parsedMarriages.length > 0) {
            setMarriages(parsedMarriages);
          }
        }

        const storedLadder = await AsyncStorage.getItem(STORAGE_LADDER);
        if (storedLadder) {
          const parsedLadder = JSON.parse(storedLadder);
          if (Array.isArray(parsedLadder) && parsedLadder.length > 0) {
            setLadderPeople(parsedLadder);
          }
        }
      } catch (e) {
        console.warn('Error leyendo sesión previa o publicaciones:', e);
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();

    // Fallback de seguridad: nunca dejar la app bloqueada más de 1.5 segundos
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    return () => clearTimeout(fallbackTimer);
  }, []);

  // 2. CARGA DE INFORMACIÓN EXCLUSIVAMENTE DESDE LA BASE DE DATOS (SUPABASE)
  const loadSupabaseData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    try {

      // A. Miembros reales de la iglesia
      const { data: membersData, error: mError } = await supabase.from('members').select('*');
      if (mError) {
        console.warn('Supabase members fetch error:', mError.message);
      } else if (membersData) {
        const memberMap = new Map<string, any>(membersData.map((m) => [m.id, m]));

        // Helper para resolver dinámicamente el nivel de generación G12 en cascada
        const resolveMemberGenLevel = (item: any, visited = new Set<string>()): number => {
          if (!item) return 2;
          if (visited.has(item.id)) return 2;
          visited.add(item.id);

          if (item.role === 'senior_pastor') return 0;
          if (item.role === 'network_pastor') return 1;

          // Si tiene leader_id registrado
          if (item.leader_id) {
            const parent = memberMap.get(item.leader_id);
            if (parent) {
              if (parent.role === 'senior_pastor' || parent.role === 'network_pastor') return 2; // Discípulo de pastor = Líder 12
              const parentLevel = resolveMemberGenLevel(parent, visited);
              if (parentLevel === 2) return 3; // Discípulo de Líder 12 = Líder 144
              if (parentLevel === 3) return 4; // Discípulo de 144 = Líder 1728
              return parentLevel + 1;
            }
          }

          // Si el nombre de cobertura apunta a un pastor
          const lName = (item.leader_name || '').toLowerCase();
          if (
            lName.includes('josue') ||
            lName.includes('josué') ||
            lName.includes('norelis')
          ) {
            return 2; // Líder 12
          }

          // Si no tiene leader_id pero tiene leader_name, intentar buscar al líder por nombre
          if (lName) {
            const cleanLead = lName.replace(/^(líder|lider|pastor|pastora)\s+/i, '').trim();
            const parentByName = membersData.find((m: any) => {
              if (m.id === item.id) return false;
              const full = `${m.first_name} ${m.last_name}`.toLowerCase();
              return full.includes(cleanLead) || cleanLead.includes(m.first_name.toLowerCase());
            });
            if (parentByName) {
              if (parentByName.role === 'senior_pastor' || parentByName.role === 'network_pastor') return 2;
              const parentLevel = resolveMemberGenLevel(parentByName, visited);
              if (parentLevel === 2) return 3;
              if (parentLevel === 3) return 4;
              return parentLevel + 1;
            }
          }

          // Si tiene generation_level explícito >= 2
          if (item.generation_level && item.generation_level >= 2) {
            return item.generation_level;
          }

          return item.role === 'g12_leader' || item.is_leader_of_12 ? 2 : 3;
        };

        let localBirthdays: Record<string, string> = {};
        try {
          const rawB = await AsyncStorage.getItem(STORAGE_MEMBER_BIRTHDAYS);
          if (rawB) localBirthdays = JSON.parse(rawB);
        } catch (_) {}

        const mappedMembers: Member[] = membersData.map((item) => {
          const leader = item.leader_id ? memberMap.get(item.leader_id) : undefined;
          const leaderName = leader ? `${leader.first_name} ${leader.last_name}` : (item.leader_name || undefined);
          const genLevel = resolveMemberGenLevel(item);
          return {
            id: item.id,
            firstName: item.first_name,
            lastName: item.last_name,
            phone: item.phone || '',
            email: item.email || undefined,
            username: item.username || undefined,
            avatarUrl: item.avatar_url || undefined,
            role: item.role,
            network: item.network,
            leaderId: item.leader_id || undefined,
            leaderName,
            isLeaderOf12: genLevel === 2,
            generationLevel: genLevel,
            familyName: item.family_name || undefined,
            gender: item.gender || undefined,
            birthDate: item.birth_date || localBirthdays[item.id] || undefined,
            preferredService: item.preferred_service_id || undefined,
            notes: item.notes || undefined,
            password: item.password || undefined,
            isActive: item.is_active ?? true,
            ministries: Array.isArray(item.ministries) ? item.ministries : undefined,
          };
        });
        setMembers(mappedMembers);

        // Actualizar sesión activa si el usuario está en los miembros cargados sin gatillar renders infinitos
        setCurrentUser((prev) => {
          if (!prev) return null;
          const fresh = mappedMembers.find((m) => m.id === prev.id);
          if (!fresh) return prev;
          if (
            prev.firstName === fresh.firstName &&
            prev.lastName === fresh.lastName &&
            prev.role === fresh.role &&
            prev.network === fresh.network &&
            prev.leaderId === fresh.leaderId &&
            prev.leaderName === fresh.leaderName &&
            prev.generationLevel === fresh.generationLevel
          ) {
            return prev;
          }
          return { ...prev, ...fresh };
        });
      }

      // B. Células reales registradas
      const { data: cellsData, error: cError } = await supabase.from('cell_groups').select('*');
      if (cError) {
        console.warn('Supabase cell_groups fetch error:', cError.message);
      } else if (cellsData) {
        const mappedCells: CellGroup[] = cellsData.map((item) => ({
          id: item.id,
          cellLeaderName: item.cell_leader_name || item.name || item.leader_name || 'Líder',
          leaderId: item.leader_id || undefined,
          leaderName: item.leader_name || '',
          assistantName: item.assistant_name || undefined,
          hostName: item.host_name || '',
          address: item.address || undefined,
          dayOfWeek: item.day_of_week || 'Miércoles',
          time: item.time_start || '19:00',
          network: item.network || 'juvenil',
          membersCount: item.members_count || 0,
          notes: item.notes || undefined,
        }));
        setCellGroups(mappedCells);
      }

      // C. Reportes semanales de reunión celular
      const { data: cellRepsData, error: crError } = await supabase.from('cell_meeting_reports').select('*');
      if (crError) {
        console.warn('Supabase cell_meeting_reports fetch error:', crError.message);
      } else if (cellRepsData && cellRepsData.length > 0) {
        const mappedReps: CellMeetingReport[] = cellRepsData.map((item) => ({
          id: item.id,
          cellId: item.cell_id,
          cellLeaderName: item.cell_leader_name,
          leaderId: item.leader_id,
          leaderName: item.leader_name,
          recipientLeaderId: item.recipient_leader_id || undefined,
          recipientLeaderName: item.recipient_leader_name || undefined,
          hostName: item.host_name,
          assistantName: item.assistant_name || undefined,
          network: item.network,
          date: item.report_date,
          membersCount: item.members_count || 0,
          membersList: Array.isArray(item.members_list) ? item.members_list : [],
          visitorsCount: item.visitors_count || 0,
          visitorsList: Array.isArray(item.visitors_list) ? item.visitors_list : [],
          conversionsCount: item.conversions_count ?? item.offering_details?.conversionsCount ?? 0,
          topic: item.topic || item.offering_details?.topic || undefined,
          status: item.status || item.offering_details?.status || 'realizada',
          offering: Number(item.offering || 0),
          offeringDetails: item.offering_details || undefined,
          notes: item.notes || undefined,
          createdAt: item.created_at,
        }));
        setCellMeetingReports(mappedReps);
      }

      // D. Reportes de asistencia al servicio dominical
      const { data: leaderRepsData, error: lrError } = await supabase
        .from('leader_attendance_reports')
        .select('*');
      if (lrError) {
        console.warn('Supabase leader_attendance_reports fetch error:', lrError.message);
      } else if (leaderRepsData) {
        const mappedLeaderReps: LeaderAttendanceReport[] = leaderRepsData.map((item) => ({
          id: item.id,
          leaderId: item.leader_id,
          leaderName: item.leader_name,
          recipientLeaderId: item.recipient_leader_id || undefined,
          recipientLeaderName: item.recipient_leader_name || undefined,
          serviceId: item.service_id,
          serviceDate: item.service_date,
          myAttendance: item.my_attendance ?? true,
          leaderGender: item.leader_gender || undefined,
          leaderAge: item.leader_age ?? undefined,
          disciples: Array.isArray(item.disciples_report) ? item.disciples_report : [],
          visitorsCount: item.visitors_count || 0,
          visitorNames: Array.isArray(item.visitor_names) ? item.visitor_names : [],
          visitors: Array.isArray(item.visitors_list) ? item.visitors_list : undefined,
          notes: item.notes || undefined,
          createdAt: item.created_at,
        }));
        setLeaderAttendanceReports(mappedLeaderReps);
      }

      // E. Eventos y órdenes de servicio (solo activos hoy en adelante)
      const { data: eventsData, error: evError } = await supabase.from('church_events').select('*');
      if (evError) {
        // Silenciar si la tabla aún no existe en Supabase para evitar saturar la consola
        if (!evError.message?.toLowerCase().includes('schema cache') && !evError.message?.toLowerCase().includes('does not exist')) {
          console.warn('Supabase church_events fetch error:', evError.message);
        }
      } else if (eventsData) {
        const today = todayISO();
        // Filtrar inmediatamente para que los eventos pasados no se muestren
        const activeEventsData = eventsData.filter((item: any) => item.event_date >= today);
        setEvents(activeEventsData.map(eventFromRow));

        // Purgar de Supabase automáticamente los eventos cuya fecha ya pasó
        const pastEvents = eventsData.filter((item: any) => item.event_date < today);
        if (pastEvents.length > 0) {
          try {
            await supabase.from('church_events').delete().lt('event_date', today);
            console.log(`Purgados ${pastEvents.length} eventos pasados de la base de datos.`);
          } catch (err) {
            console.warn('Error purgando eventos pasados:', err);
          }
        }
      }

      // F. Niños de Iglesia Infantil
      const { data: kidsData, error: kError } = await supabase.from('kids').select('*');
      if (kError) {
        console.warn('Supabase kids fetch error:', kError.message);
      } else if (kidsData) {
        const mappedKids: Kid[] = kidsData.map((k) => ({
          id: k.id,
          firstName: k.first_name,
          lastName: k.last_name,
          age: k.age || 0,
          classroomId: k.classroom_id || 'class-1',
          parentName: k.parent_name,
          parentPhone: k.parent_phone || '',
          allergies: k.allergies || 'Ninguna',
          medicalNotes: k.medical_notes || undefined,
          isCheckedIn: false,
        }));
        setKids(mappedKids);
      }

      // G. Registros de conteo de asistencia de servicios
      const { data: attData, error: aError } = await supabase.from('attendance_records').select('*');
      if (aError) {
        console.warn('Supabase attendance_records fetch error:', aError.message);
      } else if (attData) {
        const mappedAtt: AttendanceRecord[] = attData.map((a) => {
          const service = churchServicesSchedule.find((s) => s.id === a.service_id);
          return {
            id: a.id,
            serviceId: a.service_id || 'domingo_adultos_1',
            serviceName: service ? service.name : (a.service_name || 'Servicio'),
            date: a.service_date,
            network: a.network,
            menCount: a.men_count || 0,
            womenCount: a.women_count || 0,
            kidsCount: a.kids_count || 0,
            visitorsCount: a.visitors_count || 0,
            notes: a.notes || undefined,
          };
        });
        setAttendanceRecords(mappedAtt);
      }

      // H. Aulas infantiles (si existen en la base de datos)
      const { data: clsData } = await supabase.from('kid_classrooms').select('*');
      if (clsData && clsData.length > 0) {
        const mappedCls: KidClassroom[] = clsData.map((c) => ({
          id: c.id,
          name: c.name,
          ageRange: c.age_range || '',
          color: c.color || '#3B82F6',
          icon: 'shapes',
          roomNumber: c.room_number || '',
          teacherName: c.teacher_name || '',
        }));
        setClassrooms(mappedCls);
      }

      // I. Ministerios de la Iglesia (Alabanza, Audiovisual, Protocolo, etc.)
      const { data: minData, error: minError } = await supabase.from('ministries').select('*');
      if (minError) {
        if (
          !minError.message?.toLowerCase().includes('schema cache') &&
          !minError.message?.toLowerCase().includes('does not exist')
        ) {
          console.warn('Supabase ministries fetch error:', minError.message);
        }
      } else if (minData && minData.length > 0) {
        const mappedMin: Ministry[] = minData.map((m) => {
          const defMin = defaultMinistries.find(
            (d) => d.id === m.id || d.name.toLowerCase() === m.name.toLowerCase()
          );
          return {
            id: m.id,
            name: m.name,
            description: m.description || undefined,
            coordinatorId: m.coordinator_id || '',
            coordinatorName: m.coordinator_name || '',
            coordinatorPhone: m.coordinator_phone || undefined,
            color: m.color || '#2563EB',
            icon: m.icon || 'people',
            defaultRoles:
              Array.isArray(m.default_roles) && m.default_roles.length > 0
                ? m.default_roles
                : (defMin?.defaultRoles || []),
            createdAt: m.created_at,
          };
        });
        setMinistries(mappedMin);
        AsyncStorage.setItem(STORAGE_MINISTRIES, JSON.stringify(mappedMin)).catch(() => {});
      }

      // J. Peticiones de Oración de Supabase (si existe la tabla)
      try {
        const { data: prData } = await supabase.from('prayer_requests').select('*');
        if (prData && prData.length > 0) {
          const mappedPr: PrayerRequest[] = prData.map((p) => ({
            id: p.id,
            memberId: p.member_id || '',
            memberName: p.member_name || '',
            memberPhone: p.member_phone || undefined,
            category: p.category || 'otro',
            title: p.title || '',
            description: p.description || '',
            isPrivateForPastors: p.is_private_for_pastors ?? false,
            status: p.status || 'pending',
            prayingPastors: p.praying_pastors || [],
            prayingUsers: p.praying_users || [],
            prayingCount: p.praying_count !== undefined ? p.praying_count : (p.praying_users ? p.praying_users.length : 0),
            createdAt: p.created_at || new Date().toISOString(),
          }));
          setPrayerRequests(mappedPr);
          AsyncStorage.setItem(STORAGE_PRAYER_REQUESTS, JSON.stringify(mappedPr)).catch(() => {});
        }
      } catch {}

      // K. Matrimonios de Supabase (si existe la tabla)
      try {
        const { data: marData } = await supabase.from('marriages').select('*');
        if (marData && marData.length > 0) {
          const mappedMar: Marriage[] = marData.map((m) => ({
            id: m.id,
            husbandId: m.husband_id,
            husbandName: m.husband_name,
            wifeId: m.wife_id,
            wifeName: m.wife_name,
            marriageDate: m.marriage_date || undefined,
            anniversaryDate: m.anniversary_date || undefined,
            status: m.status || 'active',
            notes: m.notes || undefined,
            pastorInChargeId: m.pastor_in_charge_id || undefined,
            pastorInChargeName: m.pastor_in_charge_name || undefined,
            createdById: m.created_by_id || undefined,
            createdByName: m.created_by_name || undefined,
            network: m.network || 'adulta',
            createdAt: m.created_at || new Date().toISOString(),
            updatedAt: m.updated_at || undefined,
          }));
          setMarriages(mappedMar);
          AsyncStorage.setItem(STORAGE_MARRIAGES, JSON.stringify(mappedMar)).catch(() => {});
        }
      } catch {}

      // L. Escalera del Éxito de Supabase (si existe la tabla)
      try {
        const { data: ladData } = await supabase.from('ladder_people').select('*');
        if (ladData && ladData.length > 0) {
          const mappedLad: LadderPerson[] = ladData.map((l) => ({
            id: l.id,
            leaderId: l.leader_id,
            leaderName: l.leader_name,
            name: l.name,
            age: typeof l.age === 'number' ? l.age : undefined,
            phone: l.phone || undefined,
            stage: l.stage || 'ganar',
            status: l.status || 'active',
            notes: l.notes || undefined,
            history: Array.isArray(l.history) ? l.history : [],
            statusChangedAt: l.status_changed_at || undefined,
            createdAt: l.created_at || new Date().toISOString(),
            updatedAt: l.updated_at || undefined,
          }));
          setLadderPeople(mappedLad);
          AsyncStorage.setItem(STORAGE_LADDER, JSON.stringify(mappedLad)).catch(() => {});
        }
      } catch {}
    } catch (e) {
      console.warn('Supabase data load error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSupabaseData();
  }, [loadSupabaseData]);

  // Auth Methods: Autentica contra la base de datos
  const login = async (email: string, password?: string): Promise<LoginResult> => {
    const cleanIdentifier = email.trim().toLowerCase();

    // 1. Buscar en memoria local de miembros ya cargados (por email o username)
    let found = members.find(
      (m) =>
        m.email?.toLowerCase() === cleanIdentifier ||
        m.username?.toLowerCase() === cleanIdentifier ||
        (cleanIdentifier.includes('@') && m.username?.toLowerCase() === cleanIdentifier.split('@')[0])
    );

    // 2. Si aún no está en memoria, consultar directamente en Supabase
    if (!found && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .or(`email.ilike.${cleanIdentifier},username.ilike.${cleanIdentifier}`)
          .limit(1);

        if (!error && data && data.length > 0) {
          const item = data[0];
          found = {
            id: item.id,
            firstName: item.first_name,
            lastName: item.last_name,
            phone: item.phone || '',
            email: item.email || undefined,
            username: item.username || undefined,
            avatarUrl: item.avatar_url || undefined,
            role: item.role,
            network: item.network,
            leaderId: item.leader_id || undefined,
            leaderName: item.leader_name || undefined,
            isLeaderOf12: item.is_leader_of_12 ?? false,
            generationLevel: item.generation_level ?? 1,
            familyName: item.family_name || undefined,
            gender: item.gender || undefined,
            birthDate: item.birth_date || undefined,
            notes: item.notes || undefined,
            password: item.password || undefined,
            isActive: item.is_active ?? true,
          };
        }
      } catch (err) {
        console.warn('Error en login directo Supabase:', err);
      }
    }

    if (!found) {
      return {
        success: false,
        error: 'No encontramos ningún usuario con este usuario o correo electrónico. Verifica tus datos o regístrate.',
      };
    }

    // Verificar si la cuenta ha sido bloqueada por el pastor
    if (found.isActive === false) {
      return {
        success: false,
        error: 'Esta cuenta ha sido bloqueada o desactivada por la administración pastoral. Por favor comunícate con tu pastor.',
      };
    }

    // Validación de contraseña
    if (found.password && found.password.trim() !== '') {
      if (!password || !password.trim()) {
        return {
          success: false,
          error: 'Por favor ingresa tu contraseña para acceder a la cuenta.',
        };
      }
      if (found.password !== password) {
        return {
          success: false,
          error: 'La contraseña que ingresaste es incorrecta. Por favor verifícala e intenta nuevamente.',
        };
      }
    }

    // Resolver nivel generacional G12 exacto
    let resolvedGenLevel = found.generationLevel;
    if (!resolvedGenLevel || resolvedGenLevel === 1) {
      if (found.role === 'senior_pastor') {
        resolvedGenLevel = 0;
      } else if (found.role === 'network_pastor') {
        resolvedGenLevel = 1;
      } else {
        const leader = found.leaderId ? members.find((m) => m.id === found.leaderId) : undefined;
        if (leader) {
          if (leader.role === 'senior_pastor' || leader.role === 'network_pastor') {
            resolvedGenLevel = 2; // Discípulo de pastor = Líder 12
          } else if (leader.generationLevel === 2 || leader.isLeaderOf12) {
            resolvedGenLevel = 3; // Discípulo de Líder 12 = Líder 144
          } else if (leader.generationLevel === 3) {
            resolvedGenLevel = 4; // Discípulo de Líder 144 = Líder 1728
          } else {
            resolvedGenLevel = (leader.generationLevel || 2) + 1;
          }
        } else if (found.leaderName) {
          const lName = found.leaderName.toLowerCase();
          if (
            lName.includes('josue') ||
            lName.includes('josué') ||
            lName.includes('norelis')
          ) {
            resolvedGenLevel = 2;
          } else {
            resolvedGenLevel = 3;
          }
        } else {
          resolvedGenLevel = found.role === 'g12_leader' || found.isLeaderOf12 ? 2 : 3;
        }
      }
    }

    const user: AuthUser = {
      id: found.id,
      email: found.email || '',
      username: found.username,
      avatarUrl: found.avatarUrl,
      password: found.password,
      firstName: found.firstName,
      lastName: found.lastName,
      role: found.role,
      network: found.network,
      gender: found.gender,
      birthDate: found.birthDate,
      phone: found.phone,
      leaderId: found.leaderId,
      leaderName: found.leaderName,
      isLeaderOf12: resolvedGenLevel === 2,
      generationLevel: resolvedGenLevel,
      familyName: found.familyName,
      preferredService: found.preferredService,
      notes: found.notes,
    };
    setCurrentUser(user);
    try {
      await AsyncStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(user));
    } catch (e) {
      console.warn('Error guardando usuario en AsyncStorage:', e);
    }
    return { success: true };
  };

  // Eventos unificados y activos (hoy en adelante) para toda la iglesia
  const getVisibleEvents = useCallback(
    (): ChurchEvent[] => {
      const today = todayISO();
      return events.filter((e) => e.date >= today);
    },
    [events]
  );

  const quickDemoLogin = async (type: string) => {
    let email = 'josue.rodriguez@iglesia.org';
    if (type === 'pastor_josue' || type === 'senior_pastor' || type === 'pastor') {
      email = 'josue.rodriguez@iglesia.org';
    } else if (type === 'pastora_norelis') {
      email = 'norelis.rodriguez@iglesia.org';
    } else if (type === 'lider_yonmar' || type.includes('yonmar')) {
      email = 'yonmar22@gmail.com';
    } else if (type.includes('@')) {
      email = type;
    }

    await login(email);
  };

  const logout = async () => {
    setCurrentUser(null);
    try {
      await AsyncStorage.removeItem(STORAGE_CURRENT_USER);
    } catch (e) {
      console.warn('Error removiendo sesión:', e);
    }
    if (isSupabaseConfigured) {
      supabase.auth.signOut().catch(() => {});
    }
  };

  // G12 Helpers
  const getLeadersByNetwork = (network?: ChurchNetwork): Member[] => {
    return members.filter((m) => {
      if (m.role === 'senior_pastor') return true;
      const isLeader = m.role === 'network_pastor' || m.role === 'g12_leader' || m.isLeaderOf12;
      if (!network || network === 'general') return isLeader;
      return (m.network === network || m.network === 'general') && isLeader;
    });
  };

  const getDisciplesOfLeader = (leaderId: string): Member[] => {
    return members.filter((m) => m.leaderId === leaderId);
  };

  const checkInKid = (kidId: string): string => {
    const randomCode = `KID-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setKids((prev) =>
      prev.map((k) =>
        k.id === kidId
          ? {
              ...k,
              isCheckedIn: true,
              securityCode: randomCode,
              checkInTime: timeStr,
            }
          : k
      )
    );
    return randomCode;
  };

  const checkOutKid = (kidId: string): boolean => {
    setKids((prev) =>
      prev.map((k) =>
        k.id === kidId
          ? {
              ...k,
              isCheckedIn: false,
              securityCode: undefined,
              checkInTime: undefined,
            }
          : k
      )
    );
    return true;
  };

  const addKid = async (newKidData: Omit<Kid, 'id' | 'isCheckedIn'>) => {
    const newId = generateUUID();
    const newKid: Kid = {
      ...newKidData,
      id: newId,
      isCheckedIn: false,
    };
    setKids((prev) => [newKid, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('kids').insert({
          id: newId,
          church_id: CHURCH_ID,
          first_name: newKidData.firstName,
          last_name: newKidData.lastName,
          age: newKidData.age,
          classroom_id: newKidData.classroomId || null,
          parent_name: newKidData.parentName,
          parent_phone: newKidData.parentPhone || null,
          allergies: newKidData.allergies || 'Ninguna',
          medical_notes: newKidData.medicalNotes || null,
        });
        if (error) console.warn('Supabase addKid error:', error.message);
      } catch (err) {
        console.warn('Error saving kid to Supabase:', err);
      }
    }
  };

  const registerMember = async (
    newMemberData: Omit<Member, 'id'> & { autoLogin?: boolean }
  ): Promise<RegisterMemberResult> => {
    const cleanUsername = (newMemberData.username || '').trim().toLowerCase();
    const cleanEmail =
      newMemberData.email?.trim().toLowerCase() ||
      (cleanUsername ? `${cleanUsername}@iglesia.local` : undefined);

    // 1. Validar si ya existe una cuenta con este correo o usuario
    if (cleanUsername) {
      const existsUsername = members.some(
        (m) => m.username && m.username.trim().toLowerCase() === cleanUsername
      );
      if (existsUsername) {
        return {
          success: false,
          error: 'Ya existe una cuenta con este nombre de usuario. Por favor elige otro.',
        };
      }
    }

    if (cleanEmail) {
      const existsInLocal = members.some(
        (m) => m.email && m.email.trim().toLowerCase() === cleanEmail
      );
      if (existsInLocal) {
        return {
          success: false,
          error: 'Ya existe una cuenta registrada con este correo electrónico o usuario. Por favor inicia sesión.',
        };
      }

      if (isSupabaseConfigured) {
        try {
          const { data: existingData, error: checkError } = await supabase
            .from('members')
            .select('id')
            .ilike('email', cleanEmail)
            .limit(1);

          if (!checkError && existingData && existingData.length > 0) {
            return {
              success: false,
              error: 'Ya existe una cuenta registrada con este correo o usuario en el sistema.',
            };
          }
        } catch (e) {
          console.warn('Error verificando correo en Supabase:', e);
        }
      }
    }

    const newId = generateUUID();
    const leader = members.find((m) => m.id === newMemberData.leaderId);
    let calculatedLevel = 2;
    let calculatedRole: MemberRole = 'g12_leader';

    if (leader) {
      if (leader.role === 'senior_pastor' || leader.role === 'network_pastor') {
        calculatedLevel = 2;
        calculatedRole = 'g12_leader';
      } else if (leader.generationLevel === 2) {
        calculatedLevel = 3;
        calculatedRole = 'member';
      } else if (leader.generationLevel === 3) {
        calculatedLevel = 4;
        calculatedRole = 'member';
      }
    }

    const leaderName =
      newMemberData.leaderName || (leader ? `${leader.firstName} ${leader.lastName}` : undefined);

    const newMember: Member = {
      ...newMemberData,
      id: newId,
      phone: newMemberData.phone?.trim() || '',
      email: cleanEmail || undefined,
      username: cleanUsername || undefined,
      avatarUrl: newMemberData.avatarUrl,
      leaderName,
      role: newMemberData.role || calculatedRole,
      generationLevel: newMemberData.generationLevel || calculatedLevel,
      isLeaderOf12: (newMemberData.generationLevel || calculatedLevel) === 2,
    };

    if (isSupabaseConfigured) {
      try {
        const memberInsertPayload: any = {
          id: newId,
          church_id: CHURCH_ID,
          first_name: newMember.firstName,
          last_name: newMember.lastName,
          email: newMember.email || null,
          phone: newMember.phone || '',
          network: newMember.network,
          role: newMember.role,
          gender: newMember.gender || null,
          leader_id: newMember.leaderId || null,
          is_leader_of_12: newMember.isLeaderOf12 ?? false,
          generation_level: newMember.generationLevel ?? 2,
          family_name: newMember.familyName || null,
          preferred_service_id: sanitizeServiceId(newMember.preferredService),
          notes: newMember.notes || null,
          password: newMember.password || null,
          is_active: newMember.isActive ?? true,
        };
        const cleanedBirth = cleanDateForStorage(newMember.birthDate);
        if (cleanedBirth) {
          memberInsertPayload.birth_date = cleanedBirth;
        }
        if (newMember.avatarUrl) {
          memberInsertPayload.avatar_url = newMember.avatarUrl;
        }

        let { error: insertError } = await supabase.from('members').insert(memberInsertPayload);
        if (
          insertError &&
          (/column/i.test(insertError.message) ||
            /birth_date/i.test(insertError.message) ||
            insertError.code === '42703' ||
            (insertError as any).code === 'PGRST204')
        ) {
          delete memberInsertPayload.avatar_url;
          delete memberInsertPayload.is_active;
          delete memberInsertPayload.birth_date;
          const retryRes = await supabase.from('members').insert(memberInsertPayload);
          insertError = retryRes.error;
        }

        if (
          insertError &&
          (insertError.code === '23503' ||
            /foreign key/i.test(insertError.message) ||
            /preferred_service_id/i.test(insertError.message))
        ) {
          memberInsertPayload.preferred_service_id = null;
          const retryRes = await supabase.from('members').insert(memberInsertPayload);
          insertError = retryRes.error;
        }

        if (insertError) {
          console.error('Supabase member insert error:', insertError.message);
          return {
            success: false,
            error:
              insertError.message.includes('unique') || insertError.code === '23505'
                ? 'Ya existe una cuenta con este correo electrónico.'
                : `Error al registrar en la base de datos: ${insertError.message}`,
          };
        }
      } catch (err: any) {
        console.error('Error adding member to Supabase:', err);
        return {
          success: false,
          error: err?.message || 'Error de conexión con la base de datos al crear la cuenta.',
        };
      }
    }

    // Guardar cumpleaños en cache local
    if (newMember.birthDate) {
      await saveBirthdayLocally(newId, newMember.birthDate);
    }

    // Actualizar miembros en memoria local
    setMembers((prev) => [newMember, ...prev]);

    // Iniciar sesión automáticamente si autoLogin está activo (por defecto true)
    if (newMemberData.autoLogin !== false) {
      const authUser: AuthUser = {
        id: newMember.id,
        email: newMember.email || '',
        password: newMember.password,
        firstName: newMember.firstName,
        lastName: newMember.lastName,
        role: newMember.role,
        network: newMember.network,
        gender: newMember.gender,
        birthDate: newMember.birthDate,
        phone: newMember.phone,
        leaderId: newMember.leaderId,
        leaderName: newMember.leaderName,
        generationLevel: newMember.generationLevel,
        familyName: newMember.familyName,
        preferredService: newMember.preferredService,
        notes: newMember.notes,
      };
      setCurrentUser(authUser);
      try {
        await AsyncStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(authUser));
      } catch (e) {
        console.warn('Error guardando usuario en AsyncStorage:', e);
      }
    }

    return { success: true, member: newMember };
  };

  const addMember = async (newMemberData: Omit<Member, 'id'>) => {
    await registerMember({ ...newMemberData, autoLogin: false });
  };

  const addCellGroup = async (cellData: Omit<CellGroup, 'id'>) => {
    const newId = generateUUID();
    const newCell: CellGroup = {
      ...cellData,
      id: newId,
    };
    setCellGroups((prev) => [newCell, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('cell_groups').insert({
          id: newId,
          church_id: CHURCH_ID,
          name: `Célula de ${cellData.cellLeaderName}`,
          cell_leader_name: cellData.cellLeaderName,
          leader_id: cellData.leaderId || null,
          leader_name: cellData.leaderName,
          assistant_name: cellData.assistantName || null,
          host_name: cellData.hostName,
          address: cellData.address || null,
          day_of_week: cellData.dayOfWeek,
          time_start: cellData.time,
          network: cellData.network,
          members_count: cellData.membersCount || 0,
          notes: cellData.notes || null,
        });
        if (error) {
          console.warn('Supabase cell insert error:', error.message);
        }
      } catch (err) {
        console.warn('Error adding cell to Supabase:', err);
      }
    }
  };

  const getLeaderInCharge = (user?: AuthUser | null): { id: string; name: string } => {
    const targetUser = user || currentUser;
    if (!targetUser) {
      return { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', name: 'Pastor Josué Rodríguez' };
    }

    if (targetUser.leaderId) {
      const leaderMember = members.find((m) => m.id === targetUser.leaderId);
      if (leaderMember) {
        const prefix =
          leaderMember.role === 'senior_pastor' || leaderMember.role === 'network_pastor'
            ? leaderMember.gender === 'F'
              ? 'Pastora'
              : 'Pastor'
            : 'Líder';
        const rawName = `${leaderMember.firstName} ${leaderMember.lastName}`.trim();
        const formatted =
          rawName.toLowerCase().startsWith('pastor') || rawName.toLowerCase().startsWith('líder')
            ? rawName
            : `${prefix} ${rawName}`;
        return { id: leaderMember.id, name: formatted };
      }
    }

    if (targetUser.leaderName) {
      return { id: targetUser.leaderId || 'pastor-encargado', name: targetUser.leaderName };
    }

    return {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      name: 'Pastor Josué Rodríguez',
    };
  };

  const submitLeaderReport = async (reportData: Omit<LeaderAttendanceReport, 'id' | 'createdAt'>) => {
    const newId = generateUUID();
    const recipient = getLeaderInCharge(currentUser);
    const newReport: LeaderAttendanceReport = {
      ...reportData,
      recipientLeaderId: reportData.recipientLeaderId || recipient.id,
      recipientLeaderName: reportData.recipientLeaderName || recipient.name,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setLeaderAttendanceReports((prev) => [newReport, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const basePayload = {
          id: newId,
          church_id: CHURCH_ID,
          leader_id: reportData.leaderId || null,
          leader_name: reportData.leaderName,
          recipient_leader_id: newReport.recipientLeaderId || null,
          recipient_leader_name: newReport.recipientLeaderName || null,
          service_id: reportData.serviceId,
          service_date: reportData.serviceDate,
          my_attendance: reportData.myAttendance,
          disciples_report: reportData.disciples,
          visitors_count: reportData.visitorsCount,
          visitor_names: reportData.visitorNames,
          notes: reportData.notes || null,
        };
        let { error } = await supabase.from('leader_attendance_reports').insert({
          ...basePayload,
          leader_gender: reportData.leaderGender || null,
          leader_age: reportData.leaderAge ?? null,
          visitors_list: reportData.visitors || [],
        });
        if (error && /column/i.test(error.message)) {
          ({ error } = await supabase.from('leader_attendance_reports').insert(basePayload));
        }
        if (error) {
          console.warn('Supabase report insert error:', error.message);
        }
      } catch (err) {
        console.warn('Error adding leader report to Supabase:', err);
      }
    }
  };

  const updateLeaderReport = async (
    reportId: string,
    data: Partial<LeaderAttendanceReport>
  ) => {
    setLeaderAttendanceReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, ...data } : r))
    );

    if (isSupabaseConfigured) {
      try {
        const payload: Record<string, any> = {};
        if (data.serviceId !== undefined) payload.service_id = data.serviceId;
        if (data.serviceDate !== undefined) payload.service_date = data.serviceDate;
        if (data.myAttendance !== undefined) payload.my_attendance = data.myAttendance;
        if (data.leaderGender !== undefined) payload.leader_gender = data.leaderGender;
        if (data.leaderAge !== undefined) payload.leader_age = data.leaderAge;
        if (data.disciples !== undefined) payload.disciples_report = data.disciples;
        if (data.visitorsCount !== undefined) payload.visitors_count = data.visitorsCount;
        if (data.visitorNames !== undefined) payload.visitor_names = data.visitorNames;
        if (data.visitors !== undefined) payload.visitors_list = data.visitors;
        if (data.notes !== undefined) payload.notes = data.notes;

        const { error } = await supabase
          .from('leader_attendance_reports')
          .update(payload)
          .eq('id', reportId);

        if (error) {
          console.warn('Supabase update leader report error:', error.message);
        }
      } catch (err) {
        console.warn('Error updating leader report in Supabase:', err);
      }
    }
  };

  const deleteLeaderReport = async (reportId: string) => {
    setLeaderAttendanceReports((prev) => prev.filter((r) => r.id !== reportId));

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('leader_attendance_reports')
          .delete()
          .eq('id', reportId);

        if (error) {
          console.warn('Supabase delete leader report error:', error.message);
        }
      } catch (err) {
        console.warn('Error deleting leader report from Supabase:', err);
      }
    }
  };

  const getMyCellGroups = (): CellGroup[] => {
    if (!currentUser) return [];

    const myDisciplesList = members.filter((m) => m.leaderId === currentUser.id);
    const myDiscipleIds = new Set(myDisciplesList.map((m) => m.id));
    const myDiscipleNames = new Set(
      myDisciplesList.map((m) => `${m.firstName} ${m.lastName}`.toLowerCase().trim())
    );

    return cellGroups.filter((c) => {
      // 1. Célula dirigida por mí personalmente
      if (
        c.cellLeaderName &&
        c.cellLeaderName.toLowerCase().includes(currentUser.firstName.toLowerCase())
      ) {
        return true;
      }

      // 2. Célula donde yo soy explícitamente la cobertura de 12
      if (c.leaderId === currentUser.id) return true;
      if (
        c.leaderName &&
        c.leaderName.toLowerCase().includes(currentUser.firstName.toLowerCase())
      ) {
        return true;
      }

      // 3. Célula dirigida o cubierta por alguno de mis 12 discípulos directos
      if (c.leaderId && myDiscipleIds.has(c.leaderId)) return true;
      const cleanLeader = (c.leaderName || '').toLowerCase().trim();
      const cleanCellLeader = (c.cellLeaderName || '').toLowerCase().trim();
      if (myDiscipleNames.has(cleanLeader) || myDiscipleNames.has(cleanCellLeader)) {
        return true;
      }

      return false;
    });
  };

  const getMyDisciples = (): Member[] => {
    if (!currentUser) return [];
    return members.filter((m) => m.leaderId === currentUser.id);
  };

  const saveAttendance = async (recordData: Omit<AttendanceRecord, 'id'>) => {
    // Verificar si ya existe un registro oficial para esta misma fecha y servicio
    const existing = attendanceRecords.find(
      (a) => a.date === recordData.date && a.serviceId === recordData.serviceId
    );

    if (existing) {
      const updatedRecord: AttendanceRecord = {
        ...existing,
        ...recordData,
      };
      setAttendanceRecords((prev) =>
        prev.map((a) => (a.id === existing.id ? updatedRecord : a))
      );

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase
            .from('attendance_records')
            .update({
              men_count: recordData.menCount,
              women_count: recordData.womenCount,
              kids_count: recordData.kidsCount,
              visitors_count: recordData.visitorsCount,
              notes: recordData.notes || null,
            })
            .eq('id', existing.id);
          if (error) console.warn('Supabase update attendance error:', error.message);
        } catch (err) {
          console.warn('Error updating attendance in Supabase:', err);
        }
      }
    } else {
      const newId = generateUUID();
      const newRecord: AttendanceRecord = {
        ...recordData,
        id: newId,
      };
      setAttendanceRecords((prev) => [newRecord, ...prev]);

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from('attendance_records').insert({
            id: newId,
            church_id: CHURCH_ID,
            service_id: recordData.serviceId,
            service_date: recordData.date,
            network: recordData.network,
            men_count: recordData.menCount,
            women_count: recordData.womenCount,
            kids_count: recordData.kidsCount,
            visitors_count: recordData.visitorsCount,
            notes: recordData.notes || null,
          });
          if (error) console.warn('Supabase saveAttendance error:', error.message);
        } catch (err) {
          console.warn('Error saving attendance in Supabase:', err);
        }
      }
    }
  };

  const canManageEvents =
    currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';

  const canUserEditFullEvent = (
    eventOrId?: ChurchEvent | string | null,
    user: AuthUser | null = currentUser
  ): boolean => {
    if (!user) return false;
    // 1. Pastores Principales tienen supervisión y control total sobre todos los eventos
    if (user.role === 'senior_pastor') return true;

    // 2. Si no se pasa un evento (por ejemplo, permiso para crear un nuevo evento)
    if (!eventOrId) {
      return user.role === 'network_pastor';
    }

    const ev = typeof eventOrId === 'string' ? events.find((e) => e.id === eventOrId) : eventOrId;
    if (!ev) return false;

    // 3. El creador del evento es el dueño ("owner")
    if (ev.createdById && ev.createdById === user.id) return true;

    const userFullName = `${user.firstName} ${user.lastName}`.trim().toLowerCase();
    if (ev.createdByName && ev.createdByName.trim().toLowerCase() === userFullName) return true;

    // 4. Si el evento no tiene creador registrado (compatibilidad con eventos previos), permitir a pastores de red
    if (!ev.createdById && !ev.createdByName && user.role === 'network_pastor') {
      return true;
    }

    return false;
  };

  const upsertEventRemote = async (ev: ChurchEvent) => {
    if (!isSupabaseConfigured) return;
    try {
      const { error } = await supabase.from('church_events').upsert(eventToRow(ev));
      if (error && !error.message?.toLowerCase().includes('schema cache')) {
        console.warn('Supabase church_events upsert error:', error.message);
      }
    } catch (err) {
      console.warn('Error guardando evento en Supabase:', err);
    }
  };

  const saveEvent = async (input: ChurchEventInput): Promise<string> => {
    const now = new Date().toISOString();
    const existing = input.id ? events.find((e) => e.id === input.id) : undefined;

    // Verificación de seguridad de autoría
    if (existing) {
      if (!canUserEditFullEvent(existing, currentUser)) {
        throw new Error('No tienes permisos para modificar este evento. Solo el creador o pastores principales pueden editarlo.');
      }
    } else {
      if (!canUserEditFullEvent(null, currentUser)) {
        throw new Error('No tienes permisos para crear eventos.');
      }
    }

    const saved: ChurchEvent = existing
      ? { ...existing, ...input, id: existing.id, createdAt: existing.createdAt, updatedAt: now }
      : {
          ...input,
          id: generateUUID(),
          createdAt: now,
          updatedAt: now,
          createdById: input.createdById ?? currentUser?.id,
          createdByName:
            input.createdByName ??
            (currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : undefined),
        };
    const next = existing
      ? events.map((e) => (e.id === saved.id ? saved : e))
      : [saved, ...events];
    setEvents(next);
    upsertEventRemote(saved);
    return saved.id;
  };

  const deleteEvent = async (eventId: string) => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;

    if (!canUserEditFullEvent(target, currentUser)) {
      console.warn('No autorizado para eliminar este evento. Solo el creador o Pastores Principales.');
      return;
    }

    const next = events.filter((e) => e.id !== eventId);
    setEvents(next);
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('church_events').delete().eq('id', eventId);
        if (error && !error.message?.toLowerCase().includes('schema cache')) {
          console.warn('Supabase church_events delete:', error.message);
        }
      } catch (err) {
        console.warn('Error eliminando evento en Supabase:', err);
      }
    }
  };

  const toggleVolunteerConfirmation = async (eventId: string, volunteerId: string) => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    const vol = target.volunteers.find((v) => v.id === volunteerId);
    if (!vol) return;

    // Reglas de seguridad para confirmar/desconfirmar:
    // 1. Dueño del evento o Pastor Principal
    // 2. O el propio voluntario confirmando su participación
    // 3. O el coordinador asignado de ese ministerio
    const canEditAll = canUserEditFullEvent(target, currentUser);
    const userFullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase() : '';
    const isSelf = Boolean(
      currentUser && (
        (vol.memberId && vol.memberId === currentUser.id) ||
        (vol.assignedMemberId && vol.assignedMemberId === currentUser.id) ||
        (vol.assignedTo && vol.assignedTo.trim().toLowerCase() === userFullName)
      )
    );
    const coordinated = currentUser ? getUserCoordinatedMinistries(eventId, currentUser) : [];
    const isCoordOfVol = Boolean(vol.ministryId && coordinated.some((cm) => cm.ministryId === vol.ministryId));

    if (!canEditAll && !isSelf && !isCoordOfVol) {
      console.warn('No autorizado para modificar la confirmación de este servidor.');
      return;
    }

    const updated: ChurchEvent = {
      ...target,
      updatedAt: new Date().toISOString(),
      volunteers: target.volunteers.map((v) =>
        v.id === volunteerId ? { ...v, confirmed: !v.confirmed } : v
      ),
    };
    const next = events.map((e) => (e.id === eventId ? updated : e));
    setEvents(next);
    upsertEventRemote(updated);
  };

  const addMinistry = async (data: Omit<Ministry, 'id' | 'createdAt'>): Promise<string> => {
    if (currentUser?.role !== 'senior_pastor') {
      throw new Error('Solo los Pastores Principales tienen autorización para crear ministerios.');
    }
    const newId = generateUUID();
    const newMin: Ministry = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    const updated = [...ministries, newMin];
    setMinistries(updated);
    AsyncStorage.setItem(STORAGE_MINISTRIES, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('ministries').insert({
          id: newId,
          church_id: CHURCH_ID,
          name: data.name,
          description: data.description || null,
          coordinator_id: data.coordinatorId || null,
          coordinator_name: data.coordinatorName,
          coordinator_phone: data.coordinatorPhone || null,
          color: data.color || '#2563EB',
          icon: data.icon || 'people',
          default_roles: data.defaultRoles || [],
        });
        if (error && !error.message?.toLowerCase().includes('schema cache')) {
          console.warn('Supabase addMinistry error:', error.message);
        }
      } catch (err) {
        console.warn('Error saving ministry in Supabase:', err);
      }
    }
    return newId;
  };

  const updateMinistry = async (id: string, patch: Partial<Ministry>): Promise<void> => {
    const target = ministries.find((m) => m.id === id);
    const fullName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}`.trim().toLowerCase() : '';
    const isCoord = Boolean(
      target && currentUser && (
        (target.coordinatorId && target.coordinatorId === currentUser.id) ||
        (target.coordinatorName && target.coordinatorName.trim().toLowerCase().includes(fullName))
      )
    );
    if (currentUser?.role !== 'senior_pastor' && !isCoord) {
      throw new Error('Solo los Pastores Principales o el Coordinador asignado pueden editar este ministerio.');
    }

    const updated = ministries.map((m) => (m.id === id ? { ...m, ...patch } : m));
    setMinistries(updated);
    AsyncStorage.setItem(STORAGE_MINISTRIES, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        const payload: any = {};
        if (patch.name !== undefined) payload.name = patch.name;
        if (patch.description !== undefined) payload.description = patch.description;
        if (patch.coordinatorId !== undefined) payload.coordinator_id = patch.coordinatorId;
        if (patch.coordinatorName !== undefined) payload.coordinator_name = patch.coordinatorName;
        if (patch.coordinatorPhone !== undefined) payload.coordinator_phone = patch.coordinatorPhone;
        if (patch.color !== undefined) payload.color = patch.color;
        if (patch.icon !== undefined) payload.icon = patch.icon;
        if (patch.defaultRoles !== undefined) payload.default_roles = patch.defaultRoles;
        await supabase.from('ministries').update(payload).eq('id', id);
      } catch (err) {
        console.warn('Error updating ministry in Supabase:', err);
      }
    }
  };

  const deleteMinistry = async (id: string): Promise<void> => {
    if (currentUser?.role !== 'senior_pastor') {
      throw new Error('Solo los Pastores Principales tienen autorización para eliminar ministerios.');
    }
    const updated = ministries.filter((m) => m.id !== id);
    setMinistries(updated);
    AsyncStorage.setItem(STORAGE_MINISTRIES, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        await supabase.from('ministries').delete().eq('id', id);
      } catch (err) {
        console.warn('Error deleting ministry in Supabase:', err);
      }
    }
  };

  const assignMemberToMinistry = async (memberId: string, ministryName: string): Promise<void> => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const currentList = target.ministries || [];
    if (currentList.some((n) => n.toLowerCase() === ministryName.toLowerCase())) return;
    const updated = [...currentList, ministryName];
    await updateMember(memberId, { ministries: updated });
  };

  const removeMemberFromMinistry = async (memberId: string, ministryName: string): Promise<void> => {
    const target = members.find((m) => m.id === memberId);
    if (!target) return;
    const currentList = target.ministries || [];
    const updated = currentList.filter((n) => n.toLowerCase() !== ministryName.toLowerCase());
    await updateMember(memberId, { ministries: updated });
  };

  const deletePastEvents = async (): Promise<number> => {
    const today = todayISO();
    const past = events.filter((e) => e.date < today);
    if (past.length === 0) return 0;
    const remaining = events.filter((e) => e.date >= today);
    setEvents(remaining);
    if (isSupabaseConfigured) {
      try {
        await supabase.from('church_events').delete().lt('event_date', today);
      } catch (e) {
        console.warn('Error eliminando eventos pasados en Supabase:', e);
      }
    }
    return past.length;
  };

  const getUserCoordinatedMinistries = (
    eventId: string,
    user: AuthUser | null = currentUser
  ): EventMinistryAssignment[] => {
    if (!user) return [];
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return [];

    // El creador del evento y los Pastores Principales tienen acceso total a todos los ministerios
    const isOwnerOrSenior = canUserEditFullEvent(ev, user);

    const evMinistries =
      ev.ministries && ev.ministries.length > 0
        ? ev.ministries
        : ministries.map((m) => ({
            ministryId: m.id,
            ministryName: m.name,
            coordinatorId: m.coordinatorId,
            coordinatorName: m.coordinatorName,
            coordinatorPhone: m.coordinatorPhone,
          }));

    if (isOwnerOrSenior) return evMinistries;

    const userFullName = `${user.firstName} ${user.lastName}`.trim().toLowerCase();
    return evMinistries.filter((em) => {
      // 1. Coordinador asignado específicamente en este evento
      if (em.coordinatorId && em.coordinatorId === user.id) return true;
      if (em.coordinatorName && em.coordinatorName.toLowerCase().includes(userFullName)) return true;

      // 2. O es el coordinador permanente del ministerio
      const minObj = ministries.find((m) => m.id === em.ministryId);
      if (minObj) {
        if (minObj.coordinatorId && minObj.coordinatorId === user.id) return true;
        if (minObj.coordinatorName && minObj.coordinatorName.toLowerCase().includes(userFullName)) return true;
      }
      return false;
    });
  };

  const canUserEditEventPart = (eventId: string, user: AuthUser | null = currentUser) => {
    const canEditAll = canUserEditFullEvent(eventId, user);
    const coordinated = getUserCoordinatedMinistries(eventId, user);
    const canEditPart = canEditAll || coordinated.length > 0;
    return {
      canEditAll,
      canEditPart,
      coordinatedMinistries: coordinated,
    };
  };

  const updateEventMinistryData = async (
    eventId: string,
    ministryId: string,
    scheduleItems: ServiceScheduleItem[],
    volunteers: VolunteerRoster[],
    notes?: string
  ): Promise<void> => {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;

    // Verificar permisos:
    const canEditAll = canUserEditFullEvent(target, currentUser);
    const coordinated = getUserCoordinatedMinistries(eventId, currentUser);
    const isCoordOfThisMin = coordinated.some((cm) => cm.ministryId === ministryId);

    if (!canEditAll && !isCoordOfThisMin) {
      throw new Error('No tienes permisos para coordinar este ministerio en este evento.');
    }

    const ministryObj = ministries.find((m) => m.id === ministryId);
    const minName = ministryObj?.name || '';

    // 1. Cronograma
    const otherSchedule = target.schedule.filter((it) => {
      if (it.ministryId && it.ministryId === ministryId) return false;
      if (!it.ministryId && minName && it.title.toLowerCase().includes(minName.toLowerCase())) {
        return false;
      }
      return true;
    });

    const taggedSchedule = scheduleItems.map((it) => ({
      ...it,
      ministryId,
      ministryName: minName || it.ministryName,
    }));

    const combinedSchedule = [...otherSchedule, ...taggedSchedule].sort((a, b) => a.order - b.order);

    // 2. Servidores
    const otherVolunteers = target.volunteers.filter((v) => {
      if (v.ministryId && v.ministryId === ministryId) return false;
      if (!v.ministryId && minName && v.area.toLowerCase().includes(minName.toLowerCase())) {
        return false;
      }
      return true;
    });

    const taggedVolunteers = volunteers.map((v) => ({
      ...v,
      ministryId,
      area: minName || v.area,
    }));

    const combinedVolunteers = [...otherVolunteers, ...taggedVolunteers];

    // 3. Asignaciones de ministerios
    const currentMinistries: EventMinistryAssignment[] =
      target.ministries && target.ministries.length > 0
        ? target.ministries
        : ministries.map((m) => ({
            ministryId: m.id,
            ministryName: m.name,
            coordinatorId: m.coordinatorId,
            coordinatorName: m.coordinatorName,
            coordinatorPhone: m.coordinatorPhone,
            notes: undefined,
          }));

    const updatedMinistries: EventMinistryAssignment[] = currentMinistries.map((m) =>
      m.ministryId === ministryId ? { ...m, notes: notes !== undefined ? notes : m.notes } : m
    );

    const updatedEvent: ChurchEvent = {
      ...target,
      schedule: combinedSchedule,
      volunteers: combinedVolunteers,
      ministries: updatedMinistries,
      updatedAt: new Date().toISOString(),
    };

    const nextEvents = events.map((e) => (e.id === eventId ? updatedEvent : e));
    setEvents(nextEvents);
    upsertEventRemote(updatedEvent);
  };

  const addCellMeetingReport = async (reportData: Omit<CellMeetingReport, 'id' | 'createdAt'>) => {
    const newId = generateUUID();
    const recipient = getLeaderInCharge(currentUser);
    const newReport: CellMeetingReport = {
      ...reportData,
      recipientLeaderId: reportData.recipientLeaderId || recipient.id,
      recipientLeaderName: reportData.recipientLeaderName || recipient.name,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setCellMeetingReports((prev) => [newReport, ...prev]);

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('cell_meeting_reports').insert({
          id: newId,
          church_id: CHURCH_ID,
          cell_id: reportData.cellId,
          cell_leader_name: reportData.cellLeaderName,
          leader_id: reportData.leaderId || null,
          leader_name: reportData.leaderName,
          recipient_leader_id: newReport.recipientLeaderId || null,
          recipient_leader_name: newReport.recipientLeaderName || null,
          host_name: reportData.hostName,
          assistant_name: reportData.assistantName || null,
          network: reportData.network,
          report_date: reportData.date,
          members_count: reportData.membersCount,
          members_list: reportData.membersList || [],
          visitors_count: reportData.visitorsCount,
          visitors_list: reportData.visitorsList || [],
          offering: reportData.offering,
          offering_details: {
            ...(reportData.offeringDetails || {}),
            topic: reportData.topic,
            conversionsCount: reportData.conversionsCount,
            status: reportData.status,
          },
          notes: reportData.notes || null,
        });
        if (error) {
          console.warn('Supabase cell_meeting_reports insert error:', error.message);
        }
      } catch (err) {
        console.warn('Error adding cell meeting report to Supabase:', err);
      }
    }
  };

  const getMyCellMeetingReports = (): CellMeetingReport[] => {
    if (!currentUser) return [];
    if (currentUser.role === 'senior_pastor') {
      return cellMeetingReports;
    }
    if (currentUser.role === 'network_pastor') {
      return cellMeetingReports.filter((r) => r.network === currentUser.network);
    }

    // Para Líderes 12: incluir sus propios reportes de célula Y los reportes de sus 144 discípulos
    const myDisciplesList = members.filter((m) => m.leaderId === currentUser.id);
    const myDiscipleIds = new Set(myDisciplesList.map((m) => m.id));
    const myDiscipleNames = new Set(
      myDisciplesList.map((m) => `${m.firstName} ${m.lastName}`.toLowerCase().trim())
    );
    const myDiscipleFirstNames = new Set(
      myDisciplesList.map((m) => m.firstName.toLowerCase().trim())
    );

    const myFirst = currentUser.firstName.toLowerCase().trim();
    const myFull = `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase().trim();

    return cellMeetingReports.filter((r) => {
      // 1. Reporte dirigido o reportado por el propio líder
      if (r.leaderId === currentUser.id) return true;
      if (
        r.cellLeaderName &&
        (r.cellLeaderName.toLowerCase().includes(myFirst) ||
          r.cellLeaderName.toLowerCase().includes(myFull))
      ) {
        return true;
      }

      // 2. Reporte donde el usuario es el destinatario o cobertura
      if (r.recipientLeaderId === currentUser.id) return true;
      if (
        r.recipientLeaderName &&
        (r.recipientLeaderName.toLowerCase().includes(myFirst) ||
          r.recipientLeaderName.toLowerCase().includes(myFull))
      ) {
        return true;
      }
      if (
        r.leaderName &&
        (r.leaderName.toLowerCase().includes(myFirst) ||
          r.leaderName.toLowerCase().includes(myFull))
      ) {
        return true;
      }

      // 3. Reporte enviado por alguno de sus 144 discípulos directos
      if (r.leaderId && myDiscipleIds.has(r.leaderId)) return true;
      const cleanCellLeader = (r.cellLeaderName || '').toLowerCase().trim();
      if (myDiscipleNames.has(cleanCellLeader) || myDiscipleFirstNames.has(cleanCellLeader)) {
        return true;
      }
      for (const dName of myDiscipleNames) {
        if (cleanCellLeader.includes(dName)) return true;
      }

      return false;
    });
  };

  const getMyLeaderAttendanceReports = (): LeaderAttendanceReport[] => {
    if (!currentUser) return [];
    if (currentUser.role === 'senior_pastor' || currentUser.role === 'network_pastor') {
      return leaderAttendanceReports;
    }

    // Para Líderes 12: incluir sus propios reportes de asistencia dominical y los de sus 144 discípulos
    const myDisciplesList = members.filter((m) => m.leaderId === currentUser.id);
    const myDiscipleIds = new Set(myDisciplesList.map((m) => m.id));
    const myDiscipleNames = new Set(
      myDisciplesList.map((m) => `${m.firstName} ${m.lastName}`.toLowerCase().trim())
    );
    const myDiscipleFirstNames = new Set(
      myDisciplesList.map((m) => m.firstName.toLowerCase().trim())
    );

    const myFirst = currentUser.firstName.toLowerCase().trim();
    const myFull = `${currentUser.firstName} ${currentUser.lastName}`.toLowerCase().trim();

    return leaderAttendanceReports.filter((rep) => {
      // 1. Reporte propio
      if (rep.leaderId === currentUser.id) return true;

      // 2. Reporte enviado al líder como destinatario/cobertura
      if (rep.recipientLeaderId === currentUser.id) return true;
      if (
        rep.recipientLeaderName &&
        (rep.recipientLeaderName.toLowerCase().includes(myFirst) ||
          rep.recipientLeaderName.toLowerCase().includes(myFull))
      ) {
        return true;
      }
      if (
        rep.leaderName &&
        (rep.leaderName.toLowerCase().includes(myFirst) ||
          rep.leaderName.toLowerCase().includes(myFull))
      ) {
        return true;
      }

      // 3. Reporte de sus 144 discípulos directos
      if (rep.leaderId && myDiscipleIds.has(rep.leaderId)) return true;
      const cleanLeader = (rep.leaderName || '').toLowerCase().trim();
      if (myDiscipleNames.has(cleanLeader) || myDiscipleFirstNames.has(cleanLeader)) return true;
      for (const dName of myDiscipleNames) {
        if (cleanLeader.includes(dName)) return true;
      }

      return false;
    });
  };

  const updateUserProfile = async (
    data: UpdateProfileData
  ): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'No hay sesión de usuario activa' };

    let calculatedLeaderName = data.leaderName;
    if (data.leaderId && !calculatedLeaderName) {
      const lead = members.find((m) => m.id === data.leaderId);
      if (lead) calculatedLeaderName = `${lead.firstName} ${lead.lastName}`;
    }

    const updatedUser: AuthUser = {
      ...currentUser,
      ...data,
      leaderName: calculatedLeaderName !== undefined ? calculatedLeaderName : currentUser.leaderName,
    };
    setCurrentUser(updatedUser);
    try {
      await AsyncStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(updatedUser));
    } catch (e) {
      console.warn('Error guardando perfil en AsyncStorage:', e);
    }

    setMembers((prev) =>
      prev.map((m) =>
        m.id === currentUser.id
          ? {
              ...m,
              firstName: data.firstName ?? m.firstName,
              lastName: data.lastName ?? m.lastName,
              phone: data.phone !== undefined ? data.phone : m.phone,
              gender: data.gender !== undefined ? data.gender : m.gender,
              birthDate: data.birthDate !== undefined ? data.birthDate : m.birthDate,
              familyName: data.familyName !== undefined ? data.familyName : m.familyName,
              preferredService: data.preferredService !== undefined ? data.preferredService : m.preferredService,
              notes: data.notes !== undefined ? data.notes : m.notes,
              password: data.password !== undefined && data.password.trim() !== '' ? data.password.trim() : m.password,
              network: data.network !== undefined ? data.network : m.network,
              leaderId: data.leaderId !== undefined ? data.leaderId : m.leaderId,
              leaderName: calculatedLeaderName !== undefined ? calculatedLeaderName : m.leaderName,
              avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : m.avatarUrl,
            }
          : m
      )
    );

    if (data.birthDate !== undefined) {
      await saveBirthdayLocally(currentUser.id, data.birthDate);
    }

    if (isSupabaseConfigured) {
      try {
        const payload: any = {};
        if (data.firstName !== undefined) payload.first_name = data.firstName;
        if (data.lastName !== undefined) payload.last_name = data.lastName;
        if (data.phone !== undefined) payload.phone = data.phone;
        if (data.gender !== undefined) payload.gender = data.gender;
        if (data.birthDate !== undefined) {
          payload.birth_date = cleanDateForStorage(data.birthDate) || null;
        }
        if (data.familyName !== undefined) payload.family_name = data.familyName;
        if (data.preferredService !== undefined) payload.preferred_service_id = sanitizeServiceId(data.preferredService);
        if (data.notes !== undefined) payload.notes = data.notes;
        if (data.password !== undefined && data.password.trim() !== '') payload.password = data.password.trim();
        if (data.network !== undefined) payload.network = data.network;
        if (data.leaderId !== undefined) payload.leader_id = data.leaderId;
        if (data.avatarUrl !== undefined) payload.avatar_url = data.avatarUrl;

        let { error: sbError } = await supabase.from('members').update(payload).eq('id', currentUser.id);
        if (
          sbError &&
          (/column/i.test(sbError.message) ||
            /birth_date/i.test(sbError.message) ||
            sbError.code === '42703' ||
            (sbError as any).code === 'PGRST204')
        ) {
          delete payload.birth_date;
          const retryRes = await supabase.from('members').update(payload).eq('id', currentUser.id);
          sbError = retryRes.error;
        }
        if (
          sbError &&
          (sbError.code === '23503' ||
            /foreign key/i.test(sbError.message) ||
            /preferred_service_id/i.test(sbError.message))
        ) {
          payload.preferred_service_id = null;
          const retryRes = await supabase.from('members').update(payload).eq('id', currentUser.id);
          sbError = retryRes.error;
        }
        if (sbError) {
          console.warn('Error actualizando perfil en Supabase:', sbError.message);
          return { success: false, error: sbError.message };
        }
      } catch (e: any) {
        console.warn('Error actualizando perfil en Supabase:', e);
        return { success: false, error: e?.message || 'Error de conexión al actualizar en la nube' };
      }
    }

    return { success: true };
  };

  const updateMember = async (memberId: string, data: Partial<Member>): Promise<void> => {
    // Si se actualiza el líder directo, recalcular leaderName, generationLevel y isLeaderOf12
    let calculatedLeaderName = data.leaderName;
    let calculatedGenLevel = data.generationLevel;
    let calculatedIsLeaderOf12 = data.isLeaderOf12;

    if (data.leaderId !== undefined) {
      if (!data.leaderId) {
        calculatedLeaderName = undefined;
      } else {
        const leader = members.find((m) => m.id === data.leaderId);
        if (leader) {
          calculatedLeaderName = `${leader.firstName} ${leader.lastName}`.trim();
          if (leader.role === 'senior_pastor' || leader.role === 'network_pastor') {
            calculatedGenLevel = 2; // Discípulo de pastor = Líder 12
            calculatedIsLeaderOf12 = true;
          } else if (leader.generationLevel === 2) {
            calculatedGenLevel = 3; // Discípulo de Líder 12 = Líder 144
            calculatedIsLeaderOf12 = false;
          } else if (leader.generationLevel === 3) {
            calculatedGenLevel = 4; // Discípulo de Líder 144 = Líder 1728
            calculatedIsLeaderOf12 = false;
          }
        }
      }
    }

    const mergedData: Partial<Member> = {
      ...data,
      ...(calculatedLeaderName !== undefined ? { leaderName: calculatedLeaderName } : {}),
      ...(calculatedGenLevel !== undefined ? { generationLevel: calculatedGenLevel } : {}),
      ...(calculatedIsLeaderOf12 !== undefined ? { isLeaderOf12: calculatedIsLeaderOf12 } : {}),
    };

    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, ...mergedData } : m))
    );
    if (currentUser && currentUser.id === memberId) {
      const updatedUser: AuthUser = { ...currentUser, ...mergedData };
      setCurrentUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(updatedUser));
    }
    if (mergedData.birthDate !== undefined) {
      await saveBirthdayLocally(memberId, mergedData.birthDate);
    }

    if (isSupabaseConfigured) {
      try {
        const payload: any = {};
        if (mergedData.firstName !== undefined) payload.first_name = mergedData.firstName;
        if (mergedData.lastName !== undefined) payload.last_name = mergedData.lastName;
        if (mergedData.phone !== undefined) payload.phone = mergedData.phone;
        if (mergedData.gender !== undefined) payload.gender = mergedData.gender;
        if (mergedData.birthDate !== undefined) {
          payload.birth_date = cleanDateForStorage(mergedData.birthDate) || null;
        }
        if (mergedData.isActive !== undefined) payload.is_active = mergedData.isActive;
        if (mergedData.preferredService !== undefined) payload.preferred_service_id = sanitizeServiceId(mergedData.preferredService);
        if (mergedData.leaderId !== undefined) payload.leader_id = mergedData.leaderId;
        if (mergedData.role !== undefined) payload.role = mergedData.role;
        if (mergedData.generationLevel !== undefined) payload.generation_level = mergedData.generationLevel;
        if (mergedData.isLeaderOf12 !== undefined) payload.is_leader_of_12 = mergedData.isLeaderOf12;
        if (mergedData.avatarUrl !== undefined) payload.avatar_url = mergedData.avatarUrl;
        if (mergedData.ministries !== undefined) payload.ministries = mergedData.ministries;

        let { error: updErr } = await supabase.from('members').update(payload).eq('id', memberId);
        if (
          updErr &&
          (/column/i.test(updErr.message) ||
            /birth_date/i.test(updErr.message) ||
            updErr.code === '42703' ||
            (updErr as any).code === 'PGRST204')
        ) {
          delete payload.birth_date;
          const retryRes = await supabase.from('members').update(payload).eq('id', memberId);
          updErr = retryRes.error;
        }
        if (
          updErr &&
          (updErr.code === '23503' ||
            /foreign key/i.test(updErr.message) ||
            /preferred_service_id/i.test(updErr.message))
        ) {
          payload.preferred_service_id = null;
          await supabase.from('members').update(payload).eq('id', memberId);
        }
      } catch (e) {
        console.warn('Error en Supabase updateMember:', e);
      }
    }
  };

  const updateMembersBatch = async (
    memberIds: string[],
    data: Partial<Member>
  ): Promise<void> => {
    for (const id of memberIds) {
      await updateMember(id, data);
    }
  };

  const addPastoralPost = async (
    data: Omit<PastoralPost, 'id' | 'likes' | 'createdAt'>
  ): Promise<string> => {
    const newId = generateUUID();
    const newPost: PastoralPost = {
      ...data,
      id: newId,
      likes: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [newPost, ...pastoralPosts];
    setPastoralPosts(updated);
    AsyncStorage.setItem(STORAGE_PASTORAL_POSTS, JSON.stringify(updated)).catch(() => {});
    return newId;
  };

  const toggleLikePost = async (postId: string): Promise<void> => {
    if (!currentUser) return;
    const userId = currentUser.id;
    const updated = pastoralPosts.map((post) => {
      if (post.id !== postId) return post;
      const alreadyLiked = post.likes.includes(userId);
      const newLikes = alreadyLiked
        ? post.likes.filter((id) => id !== userId)
        : [...post.likes, userId];
      return { ...post, likes: newLikes };
    });
    setPastoralPosts(updated);
    AsyncStorage.setItem(STORAGE_PASTORAL_POSTS, JSON.stringify(updated)).catch(() => {});
  };

  const deletePastoralPost = async (postId: string): Promise<void> => {
    const updated = pastoralPosts.filter((p) => p.id !== postId);
    setPastoralPosts(updated);
    AsyncStorage.setItem(STORAGE_PASTORAL_POSTS, JSON.stringify(updated)).catch(() => {});
  };

  const addPrayerRequest = async (
    req: Omit<PrayerRequest, 'id' | 'createdAt' | 'status' | 'prayingPastors'>
  ): Promise<string> => {
    const newId = generateUUID();
    const newReq: PrayerRequest = {
      ...req,
      id: newId,
      status: 'pending',
      prayingPastors: [],
      createdAt: new Date().toISOString(),
    };
    const updated = [newReq, ...prayerRequests];
    setPrayerRequests(updated);
    AsyncStorage.setItem(STORAGE_PRAYER_REQUESTS, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        await supabase.from('prayer_requests').insert({
          id: newId,
          church_id: CHURCH_ID,
          member_id: newReq.memberId,
          member_name: newReq.memberName,
          member_phone: newReq.memberPhone || null,
          category: newReq.category,
          title: newReq.title,
          description: newReq.description,
          is_private_for_pastors: newReq.isPrivateForPastors,
          status: 'pending',
          praying_pastors: [],
          praying_users: [],
          praying_count: 0,
        });
      } catch (e) {
        // Silencioso si la tabla aún no se ha creado
      }
    }
    return newId;
  };

  const updatePrayerRequestStatus = async (
    id: string,
    status: PrayerStatus,
    pastorName?: string
  ): Promise<void> => {
    const updated = prayerRequests.map((pr) => {
      if (pr.id !== id) return pr;
      const currentPastors = pr.prayingPastors || [];
      const newPastors =
        pastorName && !currentPastors.includes(pastorName)
          ? [...currentPastors, pastorName]
          : currentPastors;
      return {
        ...pr,
        status,
        prayingPastors: newPastors,
      };
    });
    setPrayerRequests(updated);
    AsyncStorage.setItem(STORAGE_PRAYER_REQUESTS, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        const target = updated.find((p) => p.id === id);
        await supabase
          .from('prayer_requests')
          .update({
            status,
            praying_pastors: target?.prayingPastors || [],
          })
          .eq('id', id);
      } catch (e) {
        // Silencioso si no está en Supabase
      }
    }
  };

  const togglePrayerSupport = async (prayerId: string): Promise<void> => {
    if (!currentUser) return;
    const userId = currentUser.id;
    const isPastorUser =
      currentUser.role === 'senior_pastor' || currentUser.role === 'network_pastor';
    const fullName = `${currentUser.firstName} ${currentUser.lastName}`.trim();

    let targetPrToSync: PrayerRequest | undefined;

    const updated = prayerRequests.map((pr) => {
      if (pr.id !== prayerId) return pr;
      const currentUsers = pr.prayingUsers || [];
      const currentPastors = pr.prayingPastors || [];
      const alreadyPraying = currentUsers.includes(userId);

      const newUsers = alreadyPraying
        ? currentUsers.filter((id) => id !== userId)
        : [...currentUsers, userId];

      let newPastors = currentPastors;
      let newStatus: PrayerStatus = pr.status;

      if (isPastorUser) {
        if (!alreadyPraying && !currentPastors.includes(fullName)) {
          newPastors = [...currentPastors, fullName];
          newStatus = 'praying';
        }
      }

      const result: PrayerRequest = {
        ...pr,
        status: newStatus,
        prayingUsers: newUsers,
        prayingPastors: newPastors,
        prayingCount: newUsers.length,
      };
      targetPrToSync = result;
      return result;
    });

    setPrayerRequests(updated);
    AsyncStorage.setItem(STORAGE_PRAYER_REQUESTS, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured && targetPrToSync) {
      try {
        await supabase
          .from('prayer_requests')
          .update({
            status: targetPrToSync.status,
            praying_pastors: targetPrToSync.prayingPastors || [],
            praying_users: targetPrToSync.prayingUsers || [],
            praying_count: targetPrToSync.prayingCount || 0,
          })
          .eq('id', prayerId);
      } catch (e) {
        // Silencioso si falla la sincronización inmediata
      }
    }
  };

  const deletePrayerRequest = async (id: string): Promise<void> => {
    const updated = prayerRequests.filter((pr) => pr.id !== id);
    setPrayerRequests(updated);
    AsyncStorage.setItem(STORAGE_PRAYER_REQUESTS, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        await supabase.from('prayer_requests').delete().eq('id', id);
      } catch (e) {
        // Silencioso si no está en Supabase
      }
    }
  };

  // ============================================================================
  // GESTIÓN DE MATRIMONIOS & PAREJAS (EXCLUSIVO PARA CUERPO PASTORAL)
  // ============================================================================
  const addMarriage = async (
    marriageData: Omit<Marriage, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    const isPastor =
      currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';
    if (!isPastor) {
      throw new Error('Solo los pastores tienen autorización para registrar matrimonios.');
    }

    const newId = generateUUID();
    const now = new Date().toISOString();
    const newMarriage: Marriage = {
      ...marriageData,
      id: newId,
      createdById: currentUser?.id,
      createdByName: `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim(),
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newMarriage, ...marriages];
    setMarriages(updated);
    AsyncStorage.setItem(STORAGE_MARRIAGES, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        await supabase.from('marriages').insert({
          id: newId,
          church_id: CHURCH_ID,
          husband_id: newMarriage.husbandId,
          husband_name: newMarriage.husbandName,
          wife_id: newMarriage.wifeId,
          wife_name: newMarriage.wifeName,
          marriage_date: newMarriage.marriageDate || null,
          anniversary_date: newMarriage.anniversaryDate || null,
          status: newMarriage.status || 'active',
          notes: newMarriage.notes || null,
          pastor_in_charge_id: newMarriage.pastorInChargeId || null,
          pastor_in_charge_name: newMarriage.pastorInChargeName || null,
          created_by_id: newMarriage.createdById || null,
          created_by_name: newMarriage.createdByName || null,
          network: newMarriage.network || 'adulta',
          created_at: now,
          updated_at: now,
        });
      } catch (e) {
        console.warn('Error al guardar matrimonio en Supabase:', e);
      }
    }

    return newId;
  };

  const updateMarriage = async (id: string, data: Partial<Marriage>): Promise<void> => {
    const isPastor =
      currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';
    if (!isPastor) {
      throw new Error('Solo los pastores tienen autorización para editar matrimonios.');
    }

    const now = new Date().toISOString();
    const updated = marriages.map((m) =>
      m.id === id ? { ...m, ...data, updatedAt: now } : m
    );
    setMarriages(updated);
    AsyncStorage.setItem(STORAGE_MARRIAGES, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        const payload: any = { updated_at: now };
        if (data.husbandId !== undefined) payload.husband_id = data.husbandId;
        if (data.husbandName !== undefined) payload.husband_name = data.husbandName;
        if (data.wifeId !== undefined) payload.wife_id = data.wifeId;
        if (data.wifeName !== undefined) payload.wife_name = data.wifeName;
        if (data.marriageDate !== undefined) payload.marriage_date = data.marriageDate || null;
        if (data.anniversaryDate !== undefined) payload.anniversary_date = data.anniversaryDate || null;
        if (data.status !== undefined) payload.status = data.status;
        if (data.notes !== undefined) payload.notes = data.notes || null;
        if (data.pastorInChargeId !== undefined) payload.pastor_in_charge_id = data.pastorInChargeId || null;
        if (data.pastorInChargeName !== undefined) payload.pastor_in_charge_name = data.pastorInChargeName || null;
        if (data.network !== undefined) payload.network = data.network;

        await supabase.from('marriages').update(payload).eq('id', id);
      } catch (e) {
        console.warn('Error al actualizar matrimonio en Supabase:', e);
      }
    }
  };

  const deleteMarriage = async (id: string): Promise<void> => {
    const isPastor =
      currentUser?.role === 'senior_pastor' || currentUser?.role === 'network_pastor';
    if (!isPastor) {
      throw new Error('Solo los pastores tienen autorización para eliminar registros de matrimonio.');
    }

    const updated = marriages.filter((m) => m.id !== id);
    setMarriages(updated);
    AsyncStorage.setItem(STORAGE_MARRIAGES, JSON.stringify(updated)).catch(() => {});

    if (isSupabaseConfigured) {
      try {
        await supabase.from('marriages').delete().eq('id', id);
      } catch (e) {
        console.warn('Error al eliminar matrimonio en Supabase:', e);
      }
    }
  };

  // ============================================================================
  // ESCALERA DEL ÉXITO: GANAR → CONSOLIDAR → DISCIPULAR → ENVIAR
  // ============================================================================
  const persistLadder = (list: LadderPerson[]) => {
    setLadderPeople(list);
    AsyncStorage.setItem(STORAGE_LADDER, JSON.stringify(list)).catch(() => {});
  };

  const syncLadderPerson = async (p: LadderPerson) => {
    if (!isSupabaseConfigured) return;
    try {
      await supabase.from('ladder_people').upsert({
        id: p.id,
        church_id: CHURCH_ID,
        leader_id: p.leaderId,
        leader_name: p.leaderName,
        name: p.name,
        age: p.age ?? null,
        phone: p.phone || null,
        stage: p.stage,
        status: p.status,
        notes: p.notes || null,
        history: p.history,
        status_changed_at: p.statusChangedAt || null,
        created_at: p.createdAt,
        updated_at: p.updatedAt || p.createdAt,
      });
    } catch (e) {
      console.warn('Error al sincronizar escalera del éxito:', e);
    }
  };

  const addLadderPerson = async (data: {
    name: string;
    age?: number;
    phone?: string;
    notes?: string;
    stage?: LadderStage;
  }): Promise<void> => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    const initialStage: LadderStage = data.stage || 'ganar';
    const person: LadderPerson = {
      id: generateUUID(),
      leaderId: currentUser.id,
      leaderName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
      name: data.name.trim(),
      age: data.age,
      phone: data.phone?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      stage: initialStage,
      status: 'active',
      history: [{ stage: initialStage, date: now }],
      createdAt: now,
      updatedAt: now,
    };
    persistLadder([person, ...ladderPeople]);
    await syncLadderPerson(person);
  };

  const updateLadderItem = async (id: string, fn: (p: LadderPerson) => LadderPerson) => {
    let changed: LadderPerson | undefined;
    const updated = ladderPeople.map((p) => {
      if (p.id !== id) return p;
      changed = { ...fn(p), updatedAt: new Date().toISOString() };
      return changed;
    });
    persistLadder(updated);
    if (changed) await syncLadderPerson(changed);
  };

  const moveLadderPerson = (id: string, stage: LadderStage) =>
    updateLadderItem(id, (p) => ({
      ...p,
      stage,
      status: 'active',
      history: [...p.history, { stage, date: new Date().toISOString() }],
    }));

  const setLadderPersonStatus = (id: string, status: LadderStatus) =>
    updateLadderItem(id, (p) => ({ ...p, status, statusChangedAt: new Date().toISOString() }));

  const updateLadderPerson = (
    id: string,
    data: Partial<Pick<LadderPerson, 'name' | 'age' | 'phone' | 'notes'>>
  ) => updateLadderItem(id, (p) => ({ ...p, ...data }));

  const deleteLadderPerson = async (id: string): Promise<void> => {
    persistLadder(ladderPeople.filter((p) => p.id !== id));
    if (isSupabaseConfigured) {
      try {
        await supabase.from('ladder_people').delete().eq('id', id);
      } catch {}
    }
  };

  return (
    <ChurchContext.Provider
      value={{
        currentUser,
        login,
        logout,
        quickDemoLogin,
        kids,
        classrooms,
        members,
        ministries,
        attendanceRecords,
        events,
        getVisibleEvents,
        pastoralPosts,
        addPastoralPost,
        toggleLikePost,
        deletePastoralPost,
        prayerRequests,
        addPrayerRequest,
        updatePrayerRequestStatus,
        togglePrayerSupport,
        deletePrayerRequest,
        canManageEvents,
        canUserEditFullEvent,
        servicesSchedule,
        cellGroups,
        leaderAttendanceReports,
        cellMeetingReports,
        isLoading,
        refreshData: loadSupabaseData,
        getLeadersByNetwork,
        getDisciplesOfLeader,
        getMyCellGroups,
        getMyDisciples,
        getMyCellMeetingReports,
        getMyLeaderAttendanceReports,
        getLeaderInCharge,
        addMinistry,
        updateMinistry,
        deleteMinistry,
        assignMemberToMinistry,
        removeMemberFromMinistry,
        deletePastEvents,
        getUserCoordinatedMinistries,
        canUserEditEventPart,
        updateEventMinistryData,
        checkInKid,
        checkOutKid,
        addKid,
        addMember,
        registerMember,
        saveAttendance,
        toggleVolunteerConfirmation,
        saveEvent,
        deleteEvent,
        addCellGroup,
        submitLeaderReport,
        updateLeaderReport,
        deleteLeaderReport,
        addCellMeetingReport,
        updateUserProfile,
        updateMember,
        updateMembersBatch,
        marriages,
        addMarriage,
        updateMarriage,
        deleteMarriage,
        ladderPeople,
        addLadderPerson,
        moveLadderPerson,
        setLadderPersonStatus,
        updateLadderPerson,
        deleteLadderPerson,
      }}>
      {children}
    </ChurchContext.Provider>
  );
};

export const useChurch = () => {
  const context = useContext(ChurchContext);
  if (!context) {
    throw new Error('useChurch must be used within a ChurchProvider');
  }
  return context;
};
