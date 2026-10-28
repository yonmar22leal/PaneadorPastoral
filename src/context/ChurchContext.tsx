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
} from '../types/church';
import {
  churchServicesSchedule,
  mockClassrooms,
  defaultMinistries,
} from '../data/mockChurchData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
const CHURCH_ID = '11111111-1111-1111-1111-111111111111';

const defaultPastoralPosts: PastoralPost[] = [
  {
    id: 'post-1',
    authorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    authorName: 'Pastor José Peña',
    authorRole: 'senior_pastor',
    authorNetwork: 'adulta',
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
    authorRole: 'network_pastor',
    authorNetwork: 'juvenil',
    network: 'juvenil',
    title: 'Juventud: ¡Conquisten con fe y valentía!',
    content:
      'Líderes y jóvenes de la Red Juvenil, ningún desafío es demasiado grande cuando caminamos en el poder del Espíritu Santo. ¡Este domingo nos vemos con expectativa de gloria!',
    verse: {
      reference: 'Filipenses 4:13',
      text: 'Todo lo puedo en Cristo que me fortalece.',
      translation: 'RVR1960',
    },
    likes: [],
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
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
  isLoading: boolean;
  refreshData: () => Promise<void>;

  // G12 & Network Helpers
  getLeadersByNetwork: (network: ChurchNetwork) => Member[];
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
  addCellMeetingReport: (report: Omit<CellMeetingReport, 'id' | 'createdAt'>) => Promise<void>;
  updateUserProfile: (
    data: UpdateProfileData
  ) => Promise<{ success: boolean; error?: string }>;
  updateMember: (memberId: string, data: Partial<Member>) => Promise<void>;
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
              if (parent.role === 'senior_pastor') return 1;
              if (parent.role === 'network_pastor') return 2; // Discípulo de pastor de red = Líder 12
              const parentLevel = resolveMemberGenLevel(parent, visited);
              if (parentLevel === 2) return 3; // Discípulo de Líder 12 = Líder 144
              if (parentLevel === 3) return 4; // Discípulo de 144 = Líder 1728
              return parentLevel + 1;
            }
          }

          // Si el nombre de cobertura apunta a un pastor de red
          const lName = (item.leader_name || '').toLowerCase();
          if (
            lName.includes('josue') ||
            lName.includes('josué') ||
            lName.includes('norelis') ||
            lName.includes('carlos diez') ||
            lName.includes('neiyelis')
          ) {
            return 2; // Líder 12
          }

          // Si tiene generation_level explícito >= 2
          if (item.generation_level && item.generation_level >= 2) {
            return item.generation_level;
          }

          return item.role === 'g12_leader' || item.is_leader_of_12 ? 2 : 3;
        };

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
            role: item.role,
            network: item.network,
            leaderId: item.leader_id || undefined,
            leaderName,
            isLeaderOf12: genLevel === 2,
            generationLevel: genLevel,
            familyName: item.family_name || undefined,
            gender: item.gender || undefined,
            birthDate: item.birth_date || undefined,
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

      // E. Eventos y órdenes de servicio
      const { data: eventsData, error: evError } = await supabase.from('church_events').select('*');
      if (evError) {
        // Silenciar si la tabla aún no existe en Supabase para evitar saturar la consola
        if (!evError.message?.toLowerCase().includes('schema cache') && !evError.message?.toLowerCase().includes('does not exist')) {
          console.warn('Supabase church_events fetch error:', evError.message);
        }
      } else if (eventsData) {
        setEvents(eventsData.map(eventFromRow));
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
    const cleanEmail = email.trim().toLowerCase();

    // 1. Buscar en memoria local de miembros ya cargados
    let found = members.find((m) => m.email?.toLowerCase() === cleanEmail);

    // 2. Si aún no está en memoria, consultar directamente en Supabase
    if (!found && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('members')
          .select('*')
          .ilike('email', cleanEmail)
          .limit(1);

        if (!error && data && data.length > 0) {
          const item = data[0];
          found = {
            id: item.id,
            firstName: item.first_name,
            lastName: item.last_name,
            phone: item.phone || '',
            email: item.email || undefined,
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
        error: 'No encontramos ningún usuario con este correo electrónico. Verifica tus datos o regístrate.',
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
          if (leader.role === 'senior_pastor') resolvedGenLevel = 1;
          else if (leader.role === 'network_pastor') resolvedGenLevel = 2; // Líder 12
          else resolvedGenLevel = 3; // Líder 144
        } else if (found.leaderName) {
          const lName = found.leaderName.toLowerCase();
          if (
            lName.includes('josue') ||
            lName.includes('josué') ||
            lName.includes('norelis') ||
            lName.includes('carlos diez') ||
            lName.includes('neiyelis')
          ) {
            resolvedGenLevel = 2;
          } else {
            resolvedGenLevel = 3;
          }
        } else {
          resolvedGenLevel = found.role === 'g12_leader' ? 2 : 3;
        }
      }
    }

    const user: AuthUser = {
      id: found.id,
      email: found.email || '',
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

  // Filtro de eventos por Red: Los eventos de jóvenes no les salen a la red adulta, solo a pastores principales
  const getVisibleEvents = useCallback(
    (user: AuthUser | null = currentUser): ChurchEvent[] => {
      if (!user) return events;
      if (user.role === 'senior_pastor') return events;
      return events.filter((ev) => {
        if (!ev.network || ev.network === 'general') return true;
        return ev.network === user.network;
      });
    },
    [events, currentUser]
  );

  const quickDemoLogin = async (type: string) => {
    let email = 'jose.pena@iglesia.org';
    if (type === 'pastor_jose' || type === 'senior_pastor') email = 'jose.pena@iglesia.org';
    else if (type === 'pastora_neidy') email = 'neidy.pena@iglesia.org';
    else if (type === 'pastor_josue' || type === 'juvenil') email = 'josue.rodriguez@iglesia.org';
    else if (type === 'pastora_norelis') email = 'norelis.rodriguez@iglesia.org';
    else if (type === 'pastor_carlos' || type === 'adulta') email = 'carlos.diez@iglesia.org';
    else if (type === 'pastora_neiyelis') email = 'neiyelis.diez@iglesia.org';
    else if (type === 'lider_yonmar' || type.includes('yonmar')) email = 'yonmar22@gmail.com';
    else if (type.includes('@')) email = type;

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
  const getLeadersByNetwork = (network: ChurchNetwork): Member[] => {
    return members.filter((m) => {
      if (m.role === 'senior_pastor') return true;
      const isLeader = m.role === 'network_pastor' || m.role === 'g12_leader' || m.isLeaderOf12;
      return m.network === network && isLeader;
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
    const cleanEmail = newMemberData.email?.trim().toLowerCase();

    // 1. Validar si ya existe una cuenta con este correo
    if (cleanEmail) {
      const existsInLocal = members.some(
        (m) => m.email && m.email.trim().toLowerCase() === cleanEmail
      );
      if (existsInLocal) {
        return {
          success: false,
          error: 'Ya existe una cuenta registrada con este correo electrónico. Por favor inicia sesión.',
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
              error: 'Ya existe una cuenta registrada con este correo electrónico en el sistema. Por favor inicia sesión.',
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
      email: cleanEmail || undefined,
      leaderName,
      role: calculatedRole,
      generationLevel: calculatedLevel,
      isLeaderOf12: calculatedLevel === 2,
    };

    if (isSupabaseConfigured) {
      try {
        const { error: insertError } = await supabase.from('members').insert({
          id: newId,
          church_id: CHURCH_ID,
          first_name: newMember.firstName,
          last_name: newMember.lastName,
          email: newMember.email || null,
          phone: newMember.phone,
          network: newMember.network,
          role: calculatedRole,
          gender: newMember.gender || null,
          leader_id: newMember.leaderId || null,
          is_leader_of_12: calculatedLevel === 2,
          generation_level: calculatedLevel,
          family_name: newMember.familyName || null,
          preferred_service_id: newMember.preferredService || null,
          notes: newMember.notes || null,
          password: newMember.password || null,
        });

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

    if (targetUser.role === 'network_pastor') {
      return {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Pastor José Peña',
      };
    }

    if (targetUser.network === 'juvenil') {
      return {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        name: 'Pastor Josué Rodríguez',
      };
    }

    return {
      id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      name: 'Pastor Carlos Diez',
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
    if (currentUser.role === 'senior_pastor') {
      return leaderAttendanceReports;
    }
    if (currentUser.role === 'network_pastor') {
      return leaderAttendanceReports.filter((rep) => {
        if (rep.recipientLeaderId === currentUser.id) return true;
        if (
          rep.recipientLeaderName &&
          rep.recipientLeaderName.toLowerCase().includes(currentUser.firstName.toLowerCase())
        ) {
          return true;
        }
        if (
          currentUser.network === 'juvenil' &&
          (rep.serviceId === 'domingo_juvenil' || rep.serviceId === 'viernes_adoracion')
        ) {
          return true;
        }
        if (
          currentUser.network === 'adulta' &&
          (rep.serviceId === 'domingo_adultos_1' ||
            rep.serviceId === 'domingo_adultos_2' ||
            rep.serviceId === 'viernes_adoracion')
        ) {
          return true;
        }
        return rep.leaderId === currentUser.id;
      });
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
            }
          : m
      )
    );

    if (isSupabaseConfigured) {
      try {
        const payload: any = {};
        if (data.firstName !== undefined) payload.first_name = data.firstName;
        if (data.lastName !== undefined) payload.last_name = data.lastName;
        if (data.phone !== undefined) payload.phone = data.phone;
        if (data.gender !== undefined) payload.gender = data.gender;
        if (data.familyName !== undefined) payload.family_name = data.familyName;
        if (data.preferredService !== undefined) payload.preferred_service_id = data.preferredService;
        if (data.notes !== undefined) payload.notes = data.notes;
        if (data.password !== undefined && data.password.trim() !== '') payload.password = data.password.trim();
        if (data.network !== undefined) payload.network = data.network;
        if (data.leaderId !== undefined) payload.leader_id = data.leaderId;

        const { error: sbError } = await supabase.from('members').update(payload).eq('id', currentUser.id);
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
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, ...data } : m))
    );
    if (currentUser && currentUser.id === memberId) {
      const updatedUser: AuthUser = { ...currentUser, ...data };
      setCurrentUser(updatedUser);
      await AsyncStorage.setItem(STORAGE_CURRENT_USER, JSON.stringify(updatedUser));
    }
    if (isSupabaseConfigured) {
      try {
        const payload: any = {};
        if (data.firstName !== undefined) payload.first_name = data.firstName;
        if (data.lastName !== undefined) payload.last_name = data.lastName;
        if (data.phone !== undefined) payload.phone = data.phone;
        if (data.gender !== undefined) payload.gender = data.gender;
        if (data.birthDate !== undefined) payload.birth_date = data.birthDate;
        await supabase.from('members').update(payload).eq('id', memberId);
      } catch (e) {
        console.warn('Error en Supabase updateMember:', e);
      }
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
        addCellMeetingReport,
        updateUserProfile,
        updateMember,
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
