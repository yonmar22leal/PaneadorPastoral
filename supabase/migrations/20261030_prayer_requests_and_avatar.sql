-- ==============================================================================
-- MIGRACIÓN: Peticiones de Oración Multi-Dispositivo y Foto de Perfil (Avatar)
-- Fecha: 2026-10-30
-- ==============================================================================

-- 1. Agregar columna avatar_url a la tabla de miembros
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Crear tabla de peticiones de oración
CREATE TABLE IF NOT EXISTS public.prayer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_phone TEXT,
  category TEXT NOT NULL DEFAULT 'otro',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  is_private_for_pastors BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  praying_pastors TEXT[] DEFAULT '{}',
  praying_users TEXT[] DEFAULT '{}',
  praying_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar que las columnas existan si la tabla fue creada previamente
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS praying_users TEXT[] DEFAULT '{}';
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS praying_pastors TEXT[] DEFAULT '{}';
ALTER TABLE public.prayer_requests ADD COLUMN IF NOT EXISTS praying_count INT DEFAULT 0;

-- 3. Permisos y Políticas de Seguridad (RLS)
GRANT ALL ON public.prayer_requests TO anon, authenticated, service_role;

ALTER TABLE public.prayer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_anon" ON public.prayer_requests;
DROP POLICY IF EXISTS "allow_all_authenticated" ON public.prayer_requests;

CREATE POLICY "allow_all_anon" ON public.prayer_requests FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_authenticated" ON public.prayer_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
