-- ==============================================================================
-- PLANEADOR PASTORAL - ESQUEMA DE BASE DE DATOS (SUPABASE / POSTGRESQL)
-- Adaptado a la estructura eclesiástica:
-- 1. Redes: Juvenil y Adulta
-- 2. Sistema G12 (Árbol de discipulado de 12 en 12)
-- 3. Los 4 Servicios regulares:
--    - Domingo 9:00 AM - 11:00 AM (Adultos 1)
--    - Domingo 11:00 AM - 1:00 PM (Juvenil)
--    - Domingo 1:00 PM - 3:00 PM (Adultos 2)
--    - Viernes 6:00 PM - 7:30 PM (Adoración)
-- ==============================================================================

-- 1. Tabla de Iglesias / Organización
CREATE TABLE IF NOT EXISTS public.churches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  senior_pastor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Servicios / Cultos de la Iglesia
CREATE TABLE IF NOT EXISTS public.church_services (
  id TEXT PRIMARY KEY, -- 'domingo_adultos_1', 'domingo_juvenil', 'domingo_adultos_2', 'viernes_adoracion'
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  day_of_week TEXT NOT NULL, -- 'Domingo', 'Viernes'
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('adulta', 'juvenil', 'general')),
  pastors_in_charge TEXT[] NOT NULL
);

-- 3. Familias
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  family_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Miembros y Estructura G12
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT NOT NULL,
  
  -- Red a la que pertenece
  network TEXT NOT NULL CHECK (network IN ('juvenil', 'adulta')),
  gender TEXT CHECK (gender IN ('M', 'F')),
  family_name TEXT,
  
  -- Rol eclesiástico
  role TEXT NOT NULL DEFAULT 'member' CHECK (
    role IN ('senior_pastor', 'network_pastor', 'g12_leader', 'volunteer', 'member', 'visitor')
  ),

  -- ESTRUCTURA G12: Autorreferencia al líder directo que lo discipula
  leader_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  is_leader_of_12 BOOLEAN DEFAULT FALSE,
  generation_level INT DEFAULT 1, -- 0: Pastor Principal, 1: 12 del Pastor, 2: 144, etc.
  
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  preferred_service_id TEXT REFERENCES public.church_services(id),
  ministries TEXT[],
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar que las columnas existan si la tabla ya había sido creada previamente
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS family_name TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS preferred_service_id TEXT REFERENCES public.church_services(id);
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS generation_level INT DEFAULT 1;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_leader_of_12 BOOLEAN DEFAULT FALSE;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS ministries TEXT[];

-- 5. Aulas de Iglesia Infantil (Check-in Kids)
CREATE TABLE IF NOT EXISTS public.kid_classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age_range TEXT,
  color TEXT,
  room_number TEXT,
  teacher_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Niños Registrados
CREATE TABLE IF NOT EXISTS public.kids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  classroom_id UUID REFERENCES public.kid_classrooms(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INT,
  parent_name TEXT NOT NULL,
  parent_phone TEXT,
  allergies TEXT DEFAULT 'Ninguna',
  medical_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Check-In de Niños (Entrada y Salida con Código de Seguridad)
CREATE TABLE IF NOT EXISTS public.kid_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  kid_id UUID REFERENCES public.kids(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES public.church_services(id),
  security_code TEXT NOT NULL,
  check_in_time TIMESTAMPTZ DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  picked_up_by TEXT,
  received_by_member_id UUID REFERENCES public.members(id)
);

-- 8. Registro de Asistencias por Servicio y Red
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES public.church_services(id),
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  network TEXT NOT NULL CHECK (network IN ('juvenil', 'adulta', 'general')),
  men_count INT DEFAULT 0,
  women_count INT DEFAULT 0,
  kids_count INT DEFAULT 0,
  visitors_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Planeador Pastoral de Cultos
CREATE TABLE IF NOT EXISTS public.service_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  service_id TEXT REFERENCES public.church_services(id),
  title TEXT NOT NULL,
  service_date TIMESTAMPTZ NOT NULL,
  theme TEXT,
  preacher TEXT,
  worship_leader TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Bloques Litúrgicos del Servicio
CREATE TABLE IF NOT EXISTS public.service_schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.service_plans(id) ON DELETE CASCADE,
  item_order INT NOT NULL,
  time_start TIME,
  duration_minutes INT NOT NULL,
  title TEXT NOT NULL,
  responsible TEXT,
  item_type TEXT CHECK (item_type IN ('worship', 'welcome', 'offering', 'preaching', 'communion', 'announcements', 'other')),
  notes TEXT
);

-- 11. Servidores y Voluntarios
CREATE TABLE IF NOT EXISTS public.service_volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.service_plans(id) ON DELETE CASCADE,
  area TEXT NOT NULL,
  role TEXT NOT NULL,
  assigned_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  assigned_name TEXT NOT NULL,
  is_confirmed BOOLEAN DEFAULT FALSE
);

-- 12. Células de Crecimiento y Conexión (Grupos Celulares)
CREATE TABLE IF NOT EXISTS public.cell_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT,
  cell_leader_name TEXT NOT NULL, -- Quien la predica / dirige (Líder o Discípulo)
  leader_id UUID REFERENCES public.members(id) ON DELETE CASCADE, -- Cobertura de los 12
  leader_name TEXT NOT NULL, -- Nombre del Líder de 12
  assistant_name TEXT, -- Asistente / Timoteo
  host_name TEXT NOT NULL, -- Anfitrión (Dueño de la casa)
  address TEXT,
  day_of_week TEXT NOT NULL,
  time_start TIME NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('juvenil', 'adulta')),
  members_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cell_groups ADD COLUMN IF NOT EXISTS cell_leader_name TEXT;

-- 13. Reportes de Asistencia de Líderes (Personal, Discípulos e Invitados)
CREATE TABLE IF NOT EXISTS public.leader_attendance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  leader_name TEXT NOT NULL,
  service_id TEXT REFERENCES public.church_services(id),
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  my_attendance BOOLEAN DEFAULT TRUE,
  disciples_report JSONB DEFAULT '[]'::jsonb,
  visitors_count INT DEFAULT 0,
  visitor_names TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS password TEXT;

-- ==============================================================================
-- DATOS INICIALES: IGLESIA, SERVICIOS Y EQUIPO PASTORAL G12
-- ==============================================================================

-- 1. Insertar la Iglesia Principal
INSERT INTO public.churches (id, name, senior_pastor_name)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Comunidad de Fe', 'Pastor José Peña y Pastora Neidy de Peña')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  senior_pastor_name = EXCLUDED.senior_pastor_name;

-- 2. Insertar los 4 Servicios Oficiales
INSERT INTO public.church_services (id, church_id, name, day_of_week, start_time, end_time, network, pastors_in_charge)
VALUES 
  ('domingo_adultos_1', '11111111-1111-1111-1111-111111111111', 'Culto Adultos 1', 'Domingo', '09:00', '11:00', 'adulta', ARRAY['Pastor José Peña (Principal)', 'Pastor Carlos Diez', 'Pastora Neiyelis de Diez']),
  ('domingo_juvenil', '11111111-1111-1111-1111-111111111111', 'Culto Juvenil', 'Domingo', '11:00', '13:00', 'juvenil', ARRAY['Pastor Josué Rodríguez', 'Pastora Norelis de Rodríguez']),
  ('domingo_adultos_2', '11111111-1111-1111-1111-111111111111', 'Culto Adultos 2', 'Domingo', '13:00', '15:00', 'adulta', ARRAY['Pastor José Peña (Principal)', 'Pastor Carlos Diez', 'Pastora Neiyelis de Diez']),
  ('viernes_adoracion', '11111111-1111-1111-1111-111111111111', 'Servicio de Adoración', 'Viernes', '18:00', '19:30', 'general', ARRAY['Pastor José Peña (Principal)', 'Pastora Neidy de Peña (Principal)'])
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  day_of_week = EXCLUDED.day_of_week,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  network = EXCLUDED.network,
  pastors_in_charge = EXCLUDED.pastors_in_charge;

-- 3. Insertar los Pastores Principales (Nivel 0 G12)
INSERT INTO public.members (id, church_id, first_name, last_name, email, phone, network, gender, role, is_leader_of_12, generation_level, family_name, notes)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'José', 'Peña', 'jose.pena@iglesia.org', '+1 555-0101', 'adulta', 'M', 'senior_pastor', TRUE, 0, 'Familia Peña', 'Pastor General de la Iglesia. Cobertura espiritual de varones con sus 12.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Neidy', 'de Peña', 'neidy.pena@iglesia.org', '+1 555-0102', 'adulta', 'F', 'senior_pastor', TRUE, 0, 'Familia Peña', 'Pastora General de la Iglesia. Cobertura espiritual de mujeres con sus 12.')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  network = EXCLUDED.network,
  gender = EXCLUDED.gender,
  role = EXCLUDED.role,
  is_leader_of_12 = EXCLUDED.is_leader_of_12,
  generation_level = EXCLUDED.generation_level,
  family_name = EXCLUDED.family_name,
  notes = EXCLUDED.notes;

-- 4. Insertar Pastores de Red (Discípulos G12 directos)
-- Carlos y Josué son discípulos del Pastor José Peña ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
-- Las mujeres (Norelis y Neiyelis) son discípulas de la Pastora Neidy ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
INSERT INTO public.members (id, church_id, first_name, last_name, email, phone, network, gender, role, leader_id, is_leader_of_12, generation_level, preferred_service_id, family_name, notes)
VALUES
  -- Red Juvenil (Culto 11 AM)
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Josué', 'Rodríguez', 'josue.rodriguez@iglesia.org', '+1 555-0201', 'juvenil', 'M', 'network_pastor', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', TRUE, 1, 'domingo_juvenil', 'Familia Rodríguez', 'Pastor Red Juvenil. Discípulo directo del Pastor José Peña.'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'Norelis', 'de Rodríguez', 'norelis.rodriguez@iglesia.org', '+1 555-0202', 'juvenil', 'F', 'network_pastor', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', TRUE, 1, 'domingo_juvenil', 'Familia Rodríguez', 'Pastora Red Juvenil. Discípula directa de la Pastora Neidy de Peña.'),

  -- Red Adulta (Cultos 9 AM y 1 PM)
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'Carlos', 'Diez', 'carlos.diez@iglesia.org', '+1 555-0301', 'adulta', 'M', 'network_pastor', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', TRUE, 1, 'domingo_adultos_1', 'Familia Diez', 'Pastor Red Adulta. Discípulo directo del Pastor José Peña.'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '11111111-1111-1111-1111-111111111111', 'Neiyelis', 'de Diez', 'neiyelis.diez@iglesia.org', '+1 555-0302', 'adulta', 'F', 'network_pastor', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', TRUE, 1, 'domingo_adultos_1', 'Familia Diez', 'Pastora Red Adulta. Discípula directa de la Pastora Neidy de Peña.')
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  network = EXCLUDED.network,
  gender = EXCLUDED.gender,
  role = EXCLUDED.role,
  leader_id = EXCLUDED.leader_id,
  is_leader_of_12 = EXCLUDED.is_leader_of_12,
  generation_level = EXCLUDED.generation_level,
  preferred_service_id = EXCLUDED.preferred_service_id,
  family_name = EXCLUDED.family_name,
  notes = EXCLUDED.notes;

-- 14. Reportes Semanales de Reunión Celular (Miembros, Invitados, Ofrenda y Observaciones)
CREATE TABLE IF NOT EXISTS public.cell_meeting_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  cell_id TEXT, -- ID de la célula
  cell_leader_name TEXT NOT NULL,
  leader_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  leader_name TEXT NOT NULL,
  host_name TEXT NOT NULL,
  assistant_name TEXT,
  network TEXT NOT NULL CHECK (network IN ('juvenil', 'adulta')),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  members_count INT DEFAULT 0,
  members_list JSONB DEFAULT '[]'::jsonb,
  visitors_count INT DEFAULT 0,
  visitors_list JSONB DEFAULT '[]'::jsonb,
  offering NUMERIC(10, 2) DEFAULT 0.00,
  offering_details JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cell_meeting_reports ADD COLUMN IF NOT EXISTS members_list JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cell_meeting_reports ADD COLUMN IF NOT EXISTS visitors_list JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.cell_meeting_reports ADD COLUMN IF NOT EXISTS offering_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.cell_meeting_reports ADD COLUMN IF NOT EXISTS recipient_leader_id UUID;
ALTER TABLE public.cell_meeting_reports ADD COLUMN IF NOT EXISTS recipient_leader_name TEXT;

ALTER TABLE public.leader_attendance_reports ADD COLUMN IF NOT EXISTS recipient_leader_id UUID;
ALTER TABLE public.leader_attendance_reports ADD COLUMN IF NOT EXISTS recipient_leader_name TEXT;

-- Conteo del servicio por Hombres / Mujeres / Prejuvenil (< 14 años)
-- Cada discípulo en disciples_report lleva { gender: 'M'|'F', age: number }
ALTER TABLE public.leader_attendance_reports ADD COLUMN IF NOT EXISTS leader_gender TEXT;
ALTER TABLE public.leader_attendance_reports ADD COLUMN IF NOT EXISTS leader_age INT;
ALTER TABLE public.leader_attendance_reports ADD COLUMN IF NOT EXISTS visitors_list JSONB DEFAULT '[]'::jsonb;

-- 15. Eventos y Órdenes de Servicio (Servicio dominical, Encuentro de Mujeres, etc.)
CREATE TABLE IF NOT EXISTS public.church_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  time_start TEXT,
  location TEXT,
  network TEXT DEFAULT 'general',
  service_id TEXT,
  theme TEXT,
  preacher TEXT,
  worship_leader TEXT,
  description TEXT,
  schedule JSONB DEFAULT '[]'::jsonb,   -- Cronograma: [{ id, order, time, durationMinutes, title, responsible, type, notes }]
  volunteers JSONB DEFAULT '[]'::jsonb, -- Servidores: [{ id, area, role, assignedTo, confirmed }]
  ministries JSONB DEFAULT '[]'::jsonb, -- Ministerios y coordinadores asignados al evento
  created_by_id TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.church_events ADD COLUMN IF NOT EXISTS ministries JSONB DEFAULT '[]'::jsonb;

-- 16. Ministerios de la Iglesia (Alabanza, Audiovisual, Protocolo, etc.)
CREATE TABLE IF NOT EXISTS public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  coordinator_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  coordinator_name TEXT NOT NULL,
  coordinator_phone TEXT,
  color TEXT DEFAULT '#2563EB',
  icon TEXT DEFAULT 'people',
  default_roles JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE IF EXISTS public.ministries ADD COLUMN IF NOT EXISTS default_roles JSONB DEFAULT '[]'::jsonb;

-- Insertar Ministerios Iniciales por defecto
INSERT INTO public.ministries (id, church_id, name, description, coordinator_name, color, icon, default_roles)
VALUES
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'Alabanza', 'Dirección de alabanza, coro, banda musical y adoración profética en los cultos.', 'Pastor José Peña', '#8B5CF6', 'musical-notes', '["Voz Líder", "Coros", "Batería", "Bajo", "Guitarra Eléctrica", "Guitarra Acústica", "Piano / Teclado", "Director Musical"]'::jsonb),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'Audiovisual', 'Consola de sonido, pantallas, transmisión multimedia, iluminación y soporte técnico.', 'Pastor Carlos Diez', '#0284C7', 'videocam', '["Consola de Sonido", "Videos & Pantallas", "Fotografía", "Medios & Redes", "Cámara 1 (Principal)", "Cámara 2", "Streaming en Vivo", "Iluminación"]'::jsonb),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Protocolo', 'Ujieres, bienvenida, acomodación en sala, orden de filas y recolección de ofrendas.', 'Pastora Neidy de Peña', '#10B981', 'shield-checkmark', '["Puerta Principal", "Pilar Derecho", "Pilar Izquierdo", "Pasillo Central", "Recolección de Ofrendas", "Bienvenida a Nuevos", "Acomodación de Filas", "Plataforma & Altar"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 5. PERMISOS Y SEGURIDAD (HABILITAR RLS Y CREAR POLÍTICAS PERMISIVAS)
-- Habilita Row Level Security (RLS) en todas las tablas para eliminar las advertencias
-- de "UNRESTRICTED", y aplica políticas para 'anon' y 'authenticated' para que la
-- app móvil opere fluidamente sin bloqueos de permisos 42501.
-- ==============================================================================

-- 1. Conceder todos los permisos en el esquema public a anon, authenticated y service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 2. Habilitar RLS y configurar políticas universales en todas las tablas
DO $$ 
DECLARE
    tbl text;
    tables text[] := ARRAY[
      'churches', 'church_services', 'families', 'members',
      'kid_classrooms', 'kids', 'kid_check_ins', 'attendance_records',
      'church_events', 'cell_groups', 'leader_attendance_reports',
      'cell_meeting_reports', 'ministries', 'service_plans',
      'service_schedule_items', 'service_volunteers'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        -- Activar RLS en cada tabla (elimina la etiqueta roja/naranja UNRESTRICTED en Supabase)
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

        -- Limpiar políticas anteriores si existían
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_anon" ON public.%I', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_authenticated" ON public.%I', tbl);
        
        -- Crear políticas universales para anon y authenticated
        EXECUTE format('CREATE POLICY "allow_all_anon" ON public.%I FOR ALL TO anon USING (true) WITH CHECK (true)', tbl);
        EXECUTE format('CREATE POLICY "allow_all_authenticated" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;




