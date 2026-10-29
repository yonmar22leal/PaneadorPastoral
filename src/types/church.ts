export type MemberRole = 'senior_pastor' | 'network_pastor' | 'g12_leader' | 'volunteer' | 'member' | 'visitor';

export type ChurchNetwork = 'general' | 'juvenil' | 'adulta';

export type ChurchServiceSlotId = 
  | 'domingo_11am'
  | 'domingo_adultos_1' 
  | 'domingo_juvenil' 
  | 'domingo_adultos_2' 
  | 'viernes_adoracion';

export interface ChurchServiceSchedule {
  id: ChurchServiceSlotId;
  name: string;
  day: 'Domingo' | 'Viernes';
  time: string;
  network: 'adulta' | 'juvenil' | 'general';
  inChargePastors: string[];
}

export interface Family {
  id: string;
  familyName: string;
  address?: string;
  phone?: string;
  membersCount: number;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  username?: string;
  role: MemberRole;
  network: ChurchNetwork;
  gender?: 'M' | 'F';
  leaderId?: string;       // G12: ID del líder directo
  leaderName?: string;     // G12: Nombre del líder directo
  isLeaderOf12?: boolean;  // ¿Tiene su propio grupo de 12?
  generationLevel?: number; // Nivel G12 (0: Pastor Principal, 1: 12, etc.)
  disciplesCount?: number; // Cantidad de discípulos directos
  familyId?: string;
  familyName?: string;
  avatarUrl?: string;
  birthDate?: string;
  baptismDate?: string;
  isActive: boolean;
  notes?: string;
  ministries?: string[];
  preferredService?: ChurchServiceSlotId;
  password?: string;
}

export interface CellGroup {
  id: string;
  cellLeaderName: string; // Líder de Célula (quien la predica/dirige: el líder o su discípulo)
  leaderId: string; // ID del Líder de 12 (cobertura a la que pertenece la célula)
  leaderName: string; // Nombre del Líder de 12 (cobertura)
  assistantName?: string; // Asistente / Timoteo
  hostName: string; // Anfitrión (Dueño de la casa)
  address?: string; // Dirección o ubicación
  dayOfWeek: 'Lunes' | 'Martes' | 'Miércoles' | 'Jueves' | 'Viernes' | 'Sábado' | 'Domingo';
  time: string; // ej: '7:00 PM'
  network: ChurchNetwork;
  membersCount?: number;
  notes?: string;
}

export type PersonGender = 'M' | 'F';

/** Categorías de conteo del servicio. Prejuvenil = menor de 14 años. */
export type AttendanceCategory = 'hombres' | 'mujeres' | 'prejuvenil' | 'sin_clasificar';

export interface DiscipleAttendanceItem {
  memberId: string;
  name: string;
  attended: boolean;
  notes?: string;
  gender?: PersonGender;
  age?: number;
}

export interface ReportVisitorItem {
  id: string;
  name: string;
  gender?: PersonGender;
  age?: number;
}

export interface LeaderAttendanceReport {
  id: string;
  leaderId: string;
  leaderName: string;
  recipientLeaderId?: string; // ID del pastor/líder que recibe el reporte (ej: Pastor Josué)
  recipientLeaderName?: string; // Nombre del pastor/líder que recibe el reporte
  serviceId: ChurchServiceSlotId;
  serviceDate: string;
  myAttendance: boolean;
  leaderGender?: PersonGender;
  leaderAge?: number;
  disciples: DiscipleAttendanceItem[];
  visitorsCount: number;
  visitorNames: string[];
  visitors?: ReportVisitorItem[]; // Invitados con sexo y edad (para el conteo)
  notes?: string;
  createdAt: string;
}

export interface CellPersonItem {
  id: string;
  name: string;
  age?: string;
}

export interface CellOfferingDetails {
  usdCash?: number;
  vesCash?: number;
  pagoMovilAmount?: number;
  pagoMovilReference?: string;
}

export interface CellMeetingReport {
  id: string;
  cellId: string;
  cellLeaderName: string; // Líder de célula
  leaderId: string;       // Cobertura G12 que reporta
  leaderName: string;     // Cobertura G12 que reporta
  recipientLeaderId?: string; // ID del pastor/líder encargado que recibe el reporte (ej: Pastor Josué)
  recipientLeaderName?: string; // Nombre del pastor/líder encargado (ej: Pastor Josué Rodríguez)
  hostName: string;       // Anfitrión
  assistantName?: string; // Asistente
  network: ChurchNetwork;
  date: string;           // Fecha de la reunión
  membersCount: number;   // Miembros que asistieron
  membersList?: CellPersonItem[]; // Lista de miembros con nombre y edad
  visitorsCount: number;  // Invitados
  visitorsList?: CellPersonItem[]; // Lista de invitados con nombre y edad
  conversionsCount?: number; // Aceptó a Cristo / Decisiones
  topic?: string;         // Palabra Predicada (Tema de la semana)
  status?: 'realizada' | 'no_asistio_nadie' | 'no_realizo'; // Estado de la célula
  offering: number;       // Ofrenda (monto numérico referencial)
  offeringDetails?: CellOfferingDetails; // Detalle de Dólares, Bs y Pago Móvil
  notes?: string;         // Observaciones
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: MemberRole;
  network: ChurchNetwork;
  gender?: 'M' | 'F';
  birthDate?: string;
  phone?: string;
  leaderId?: string;
  leaderName?: string;
  isLeaderOf12?: boolean;
  generationLevel?: number; // 0: Pastor Principal, 1: Pastor Red, 2: Líder 12, 3: 144, 4: 1728
  token?: string;
  familyName?: string;
  preferredService?: ChurchServiceSlotId;
  notes?: string;
}

export interface KidClassroom {
  id: string;
  name: string;
  ageRange: string;
  color: string;
  icon: string;
  roomNumber: string;
  teacherName: string;
}

export interface Kid {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  birthDate?: string;
  classroomId: string;
  parentName: string;
  parentPhone: string;
  allergies?: string;
  medicalNotes?: string;
  isCheckedIn: boolean;
  securityCode?: string;
  checkInTime?: string;
  avatarUrl?: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  serviceId: ChurchServiceSlotId;
  serviceName: string;
  network: ChurchNetwork | 'general';
  menCount: number;
  womenCount: number;
  kidsCount: number;
  visitorsCount: number;
  notes?: string;
}

export interface Ministry {
  id: string;
  name: string; // ej: 'Alabanza', 'Audiovisual', 'Protocolo'
  description?: string;
  coordinatorId: string; // ID del miembro/pastor coordinador permanente
  coordinatorName: string; // Nombre del coordinador permanente
  coordinatorPhone?: string;
  color?: string; // Color distintivo para badges
  icon?: string; // Nombre de icono Ionicons
  defaultRoles?: string[]; // Roles habituales sugeridos (ej: Consola, Videos, Foto, Puerta, Pilar derecho...)
  createdAt?: string;
}

export interface EventMinistryAssignment {
  ministryId: string;
  ministryName: string;
  coordinatorId: string;
  coordinatorName: string;
  coordinatorPhone?: string;
  notes?: string;
}

export interface ServiceScheduleItem {
  id: string;
  order: number;
  time: string;
  durationMinutes: number;
  title: string;
  responsible: string;
  notes?: string;
  type: 'worship' | 'welcome' | 'offering' | 'preaching' | 'communion' | 'announcements' | 'other';
  ministryId?: string;
  ministryName?: string;
}

export interface VolunteerRoster {
  id: string;
  area: string;
  role: string;
  assignedTo: string;
  confirmed: boolean;
  phone?: string;
  ministryId?: string;
  assignedMemberId?: string;
  memberId?: string;
}

export interface ServicePlan {
  id: string;
  serviceSlotId: ChurchServiceSlotId;
  title: string;
  date: string;
  time: string;
  network: ChurchNetwork | 'general';
  theme: string;
  preacher: string;
  pastorsInCharge: string[];
  worshipLeader: string;
  schedule: ServiceScheduleItem[];
  volunteers: VolunteerRoster[];
}

export type ChurchEventType = 'servicio' | 'evento';

/** Evento de la iglesia con su orden / cronograma (servicio dominical, encuentros, etc.) */
export interface ChurchEvent {
  id: string;
  type: ChurchEventType;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // ej: '9:00 AM'
  location?: string;
  network: ChurchNetwork | 'general';
  serviceSlotId?: ChurchServiceSlotId;
  theme?: string;
  preacher?: string;
  worshipLeader?: string;
  description?: string;
  schedule: ServiceScheduleItem[];
  volunteers: VolunteerRoster[];
  ministries?: EventMinistryAssignment[];
  createdById?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BibleVerseAttachment {
  reference: string; // ej: "Filipenses 4:13" o "John 3:16"
  text: string;      // Texto del versículo
  translation?: string; // ej: "RVR1960" o "World English Bible"
}

export interface PastoralPost {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: MemberRole;
  authorNetwork?: ChurchNetwork; // Red ministerial del autor (independiente de la red destino)
  network: ChurchNetwork | 'general';
  title: string;
  content: string;
  verse?: BibleVerseAttachment;
  likes: string[]; // Lista de IDs de miembros que le dieron me gusta
  createdAt: string;
}

