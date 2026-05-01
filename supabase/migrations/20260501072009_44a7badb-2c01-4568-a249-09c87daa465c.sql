-- 1) Extend existing subjects table (keep slug; add code synced from slug, PL/EN/level/active/updated_at)
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS description_pl text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.subjects SET code = slug WHERE code IS NULL;
ALTER TABLE public.subjects ALTER COLUMN code SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subjects_code_key') THEN
    ALTER TABLE public.subjects ADD CONSTRAINT subjects_code_key UNIQUE (code);
  END IF;
END $$;

DROP TRIGGER IF EXISTS subjects_touch ON public.subjects;
CREATE TRIGGER subjects_touch BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) knowledge_components
CREATE TABLE IF NOT EXISTS public.knowledge_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_pl text NOT NULL,
  name_en text,
  description_pl text,
  description_en text,
  grade_level text,
  parent_kc_id uuid REFERENCES public.knowledge_components(id) ON DELETE SET NULL,
  order_index int NOT NULL DEFAULT 0,
  difficulty_level int NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_id, code)
);
ALTER TABLE public.knowledge_components ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS knowledge_components_touch ON public.knowledge_components;
CREATE TRIGGER knowledge_components_touch BEFORE UPDATE ON public.knowledge_components
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "kc read active" ON public.knowledge_components
  FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "kc admin manage" ON public.knowledge_components
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- 3) kc_prerequisites
CREATE TABLE IF NOT EXISTS public.kc_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  from_kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  to_kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  strength numeric NOT NULL DEFAULT 1.0 CHECK (strength >= 0 AND strength <= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_kc_id, to_kc_id),
  CHECK (from_kc_id <> to_kc_id)
);
ALTER TABLE public.kc_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kcp read" ON public.kc_prerequisites
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kcp admin manage" ON public.kc_prerequisites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

-- 4) Helper: parent owns this child placeholder
CREATE OR REPLACE FUNCTION public.is_parent_of_child(_parent_id uuid, _child_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_children
    WHERE id = _child_id AND parent_id = _parent_id
  );
$$;

-- 5) child_kc_mastery
CREATE TABLE IF NOT EXISTS public.child_kc_mastery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.parent_children(id) ON DELETE CASCADE,
  kc_id uuid NOT NULL REFERENCES public.knowledge_components(id) ON DELETE CASCADE,
  mastery_prob numeric NOT NULL DEFAULT 0.0 CHECK (mastery_prob >= 0 AND mastery_prob <= 1),
  confidence numeric NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
  source text NOT NULL DEFAULT 'manual',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, kc_id)
);
ALTER TABLE public.child_kc_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mastery parent all" ON public.child_kc_mastery
  FOR ALL TO authenticated
  USING (public.is_parent_of_child(auth.uid(), child_id) OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.is_parent_of_child(auth.uid(), child_id) OR public.has_role(auth.uid(),'admin'::public.app_role));

-- 6) learning_goals
CREATE TABLE IF NOT EXISTS public.learning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.parent_children(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  target_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','archived')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_goals ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS learning_goals_touch ON public.learning_goals;
CREATE TRIGGER learning_goals_touch BEFORE UPDATE ON public.learning_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "goals parent all" ON public.learning_goals
  FOR ALL TO authenticated
  USING (public.is_parent_of_child(auth.uid(), child_id) OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.is_parent_of_child(auth.uid(), child_id) OR public.has_role(auth.uid(),'admin'::public.app_role));

-- 7) Seed subject + KCs + prereqs (Math 7–9)
INSERT INTO public.subjects (slug, code, name_pl, name_en, category, level, is_active)
VALUES ('math_7_9','math_7_9','Matematyka klasy 7–9','Mathematics grades 7–9','math','grades_7_9',true)
ON CONFLICT (slug) DO UPDATE SET
  code = EXCLUDED.code, name_pl = EXCLUDED.name_pl, name_en = EXCLUDED.name_en,
  level = EXCLUDED.level, is_active = true;

WITH s AS (SELECT id FROM public.subjects WHERE code='math_7_9'),
parents AS (
  INSERT INTO public.knowledge_components (subject_id, code, name_pl, grade_level, order_index, difficulty_level)
  SELECT s.id, v.code, v.name, 'grades_7_9', v.ord, 1
  FROM s, (VALUES
    ('grp_liczby','Liczby i działania',1),
    ('grp_ulamki','Ułamki i procenty',2),
    ('grp_algebra','Algebra',3),
    ('grp_rownania','Równania',4),
    ('grp_funkcje','Funkcje',5),
    ('grp_geometria','Geometria',6),
    ('grp_statystyka','Statystyka i prawdopodobieństwo',7)
  ) AS v(code, name, ord)
  ON CONFLICT (subject_id, code) DO UPDATE SET name_pl = EXCLUDED.name_pl
  RETURNING id, code
),
kcs AS (
  INSERT INTO public.knowledge_components (subject_id, code, name_pl, grade_level, parent_kc_id, order_index, difficulty_level)
  SELECT s.id, v.code, v.name, 'grades_7_9', p.id, v.ord, v.diff
  FROM s, parents p, (VALUES
    -- Liczby i działania
    ('liczby_naturalne_i_calkowite','Liczby naturalne i całkowite','grp_liczby',1,1),
    ('kolejnosc_wykonywania_dzialan','Kolejność wykonywania działań','grp_liczby',2,1),
    ('potegi_i_pierwiastki','Potęgi i pierwiastki','grp_liczby',3,2),
    -- Ułamki i procenty
    ('ulamki_zwykle','Ułamki zwykłe','grp_ulamki',1,1),
    ('ulamki_dziesietne','Ułamki dziesiętne','grp_ulamki',2,1),
    ('procenty_podstawy','Procenty — podstawy','grp_ulamki',3,2),
    ('procenty_w_zadaniach','Procenty w zadaniach tekstowych','grp_ulamki',4,3),
    -- Algebra
    ('wyrazenia_algebraiczne','Wyrażenia algebraiczne','grp_algebra',1,2),
    ('redukcja_wyrazow_podobnych','Redukcja wyrazów podobnych','grp_algebra',2,2),
    ('wzory_skroconego_mnozenia_intro','Wzory skróconego mnożenia (wstęp)','grp_algebra',3,3),
    -- Równania
    ('rownania_liniowe','Równania liniowe','grp_rownania',1,2),
    ('nierownosci_liniowe','Nierówności liniowe','grp_rownania',2,3),
    ('uklady_rownan_intro','Układy równań (wstęp)','grp_rownania',3,3),
    -- Funkcje
    ('funkcja_liniowa_intro','Funkcja liniowa (wstęp)','grp_funkcje',1,3),
    ('odczytywanie_wykresow','Odczytywanie wykresów','grp_funkcje',2,2),
    -- Geometria
    ('figury_plaskie_pola','Figury płaskie — pola','grp_geometria',1,2),
    ('trojkaty_i_katy','Trójkąty i kąty','grp_geometria',2,2),
    ('twierdzenie_pitagorasa','Twierdzenie Pitagorasa','grp_geometria',3,3),
    ('bryly_pola_i_objetosci','Bryły — pola i objętości','grp_geometria',4,3),
    -- Statystyka
    ('srednia_mediana_moda','Średnia, mediana, moda','grp_statystyka',1,2),
    ('prawdopodobienstwo_podstawy','Prawdopodobieństwo — podstawy','grp_statystyka',2,2)
  ) AS v(code, name, parent_code, ord, diff)
  WHERE p.code = v.parent_code
  ON CONFLICT (subject_id, code) DO UPDATE SET name_pl = EXCLUDED.name_pl, parent_kc_id = EXCLUDED.parent_kc_id
  RETURNING id, code
)
SELECT 1;

-- Prerequisite edges
WITH s AS (SELECT id FROM public.subjects WHERE code='math_7_9'),
src AS (SELECT id, code FROM public.knowledge_components WHERE subject_id = (SELECT id FROM s))
INSERT INTO public.kc_prerequisites (subject_id, from_kc_id, to_kc_id, strength)
SELECT (SELECT id FROM s), f.id, t.id, 1.0
FROM (VALUES
  ('ulamki_zwykle','procenty_podstawy'),
  ('procenty_podstawy','procenty_w_zadaniach'),
  ('wyrazenia_algebraiczne','rownania_liniowe'),
  ('rownania_liniowe','uklady_rownan_intro'),
  ('odczytywanie_wykresow','funkcja_liniowa_intro'),
  ('trojkaty_i_katy','twierdzenie_pitagorasa'),
  ('figury_plaskie_pola','bryly_pola_i_objetosci')
) AS e(fc, tc)
JOIN src f ON f.code = e.fc
JOIN src t ON t.code = e.tc
ON CONFLICT (from_kc_id, to_kc_id) DO NOTHING;