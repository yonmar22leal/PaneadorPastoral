import {
  Kid,
  KidClassroom,
  Member,
  AttendanceRecord,
  ChurchEvent,
  ChurchServiceSchedule,
  CellGroup,
  LeaderAttendanceReport,
  CellMeetingReport,
  Ministry,
} from '../types/church';

export const churchServicesSchedule: ChurchServiceSchedule[] = [
  {
    id: 'domingo_adultos_1',
    name: 'Servicio Adultos 1',
    day: 'Domingo',
    time: '9:00 AM - 11:00 AM',
    network: 'adulta',
    inChargePastors: ['Pastor José Peña (Principal)', 'Pastor Carlos Diez', 'Pastora Neiyelis de Diez'],
  },
  {
    id: 'domingo_juvenil',
    name: 'Servicio Juvenil',
    day: 'Domingo',
    time: '11:00 AM - 1:00 PM',
    network: 'juvenil',
    inChargePastors: ['Pastor Josué Rodríguez', 'Pastora Norelis de Rodríguez'],
  },
  {
    id: 'domingo_adultos_2',
    name: 'Servicio Adultos 2',
    day: 'Domingo',
    time: '1:00 PM - 3:00 PM',
    network: 'adulta',
    inChargePastors: ['Pastor José Peña (Principal)', 'Pastor Carlos Diez', 'Pastora Neiyelis de Diez'],
  },
  {
    id: 'viernes_adoracion',
    name: 'Servicio de Adoración',
    day: 'Viernes',
    time: '6:00 PM - 7:30 PM',
    network: 'general',
    inChargePastors: ['Pastor José Peña (Principal)', 'Pastora Neidy de Peña (Principal)'],
  },
];

export const mockClassrooms: KidClassroom[] = [
  {
    id: 'class-1',
    name: 'Cunas & Bebés',
    ageRange: '0 - 2 años',
    color: '#3B82F6',
    icon: 'baby-carriage',
    roomNumber: 'Salón 101',
    teacherName: 'Equipo Infantil',
  },
  {
    id: 'class-2',
    name: 'Párvulos (Ovejitas)',
    ageRange: '3 - 5 años',
    color: '#10B981',
    icon: 'shapes',
    roomNumber: 'Salón 102',
    teacherName: 'Equipo Infantil',
  },
  {
    id: 'class-3',
    name: 'Exploradores de Fe',
    ageRange: '6 - 8 años',
    color: '#F59E0B',
    icon: 'compass',
    roomNumber: 'Salón 104',
    teacherName: 'Equipo Infantil',
  },
  {
    id: 'class-4',
    name: 'Campeones del Reino',
    ageRange: '9 - 12 años',
    color: '#8B5CF6',
    icon: 'award',
    roomNumber: 'Salón 201',
    teacherName: 'Equipo Infantil',
  },
];

// Todo vacío: la única fuente de verdad es la base de datos Supabase
export const initialMembers: Member[] = [];
export const initialKids: Kid[] = [];
export const initialAttendanceRecords: AttendanceRecord[] = [];
export const initialEvents: ChurchEvent[] = [];
export const initialCellGroups: CellGroup[] = [];
export const initialLeaderReports: LeaderAttendanceReport[] = [];
export const initialCellMeetingReports: CellMeetingReport[] = [];

export const defaultMinistries: Ministry[] = [
  {
    id: 'min_alabanza',
    name: 'Alabanza',
    description: 'Dirección de alabanza, coro, banda musical y adoración profética en los cultos.',
    coordinatorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    coordinatorName: 'Pastor José Peña',
    color: '#8B5CF6',
    icon: 'musical-notes',
    defaultRoles: [
      'Voz Líder',
      'Coros',
      'Batería',
      'Bajo',
      'Guitarra Eléctrica',
      'Guitarra Acústica',
      'Piano / Teclado',
      'Director Musical',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'min_audiovisual',
    name: 'Audiovisual',
    description: 'Consola de sonido, pantallas, transmisión multimedia, iluminación y soporte técnico.',
    coordinatorId: 'carlos-diez-id',
    coordinatorName: 'Pastor Carlos Diez',
    color: '#0284C7',
    icon: 'videocam',
    defaultRoles: [
      'Consola de Sonido',
      'Videos & Pantallas',
      'Fotografía',
      'Medios & Redes',
      'Cámara 1 (Principal)',
      'Cámara 2',
      'Streaming en Vivo',
      'Iluminación',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'min_protocolo',
    name: 'Protocolo',
    description: 'Ujieres, bienvenida, acomodación en sala, orden de filas y recolección de ofrendas.',
    coordinatorId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    coordinatorName: 'Pastora Neidy de Peña',
    color: '#10B981',
    icon: 'shield-checkmark',
    defaultRoles: [
      'Puerta Principal',
      'Pilar Derecho',
      'Pilar Izquierdo',
      'Pasillo Central',
      'Recolección de Ofrendas',
      'Bienvenida a Nuevos',
      'Acomodación de Filas',
      'Plataforma & Altar',
    ],
    createdAt: '2026-01-01T00:00:00Z',
  },
];

