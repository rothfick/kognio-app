
-- ============================================================
-- UNIVERSAL CURRICULUM & COMPETENCY GRAPH FOUNDATION
-- ============================================================

-- 1. EDUCATION SYSTEMS
CREATE TABLE public.education_systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  country_code text,
  name_pl text NOT NULL,
  name_en text,
  name_es text,
  description_pl text,
  description_en text,
  description_es text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.education_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edu_systems read active" ON public.education_systems FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "edu_systems admin manage" ON public.education_systems FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_edu_systems_updated BEFORE UPDATE ON public.education_systems FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. EDUCATION LEVELS
CREATE TABLE public.education_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  education_system_id uuid NOT NULL REFERENCES public.education_systems(id) ON DELETE CASCADE,
  code text NOT NULL,
  name_pl text NOT NULL,
  name_en text,
  name_es text,
  age_min int,
  age_max int,
  order_index int NOT NULL DEFAULT 0,
  description_pl text,
  description_en text,
  description_es text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(education_system_id, code)
);
ALTER TABLE public.education_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "edu_levels read active" ON public.education_levels FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "edu_levels admin manage" ON public.education_levels FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. LEARNING DOMAINS
CREATE TABLE public.learning_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_pl text NOT NULL,
  name_en text,
  name_es text,
  description_pl text,
  description_en text,
  description_es text,
  domain_type text NOT NULL DEFAULT 'academic' CHECK (domain_type IN ('academic','language','professional','university','custom')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domains read active" ON public.learning_domains FOR SELECT TO authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "domains admin manage" ON public.learning_domains FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. COMPETENCIES
CREATE TABLE public.competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL REFERENCES public.learning_domains(id) ON DELETE CASCADE,
  education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL,
  parent_competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL,
  code text NOT NULL,
  name_pl text NOT NULL,
  name_en text,
  name_es text,
  description_pl text,
  description_en text,
  description_es text,
  difficulty_level int NOT NULL DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
  bloom_level text,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('official_curriculum','exam_standard','university_syllabus','professional_standard','ai_generated','manual')),
  review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','ai_generated','expert_reviewed','approved','deprecated')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_id, education_level_id, code)
);
CREATE INDEX idx_competencies_domain ON public.competencies(domain_id);
CREATE INDEX idx_competencies_level ON public.competencies(education_level_id);
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competencies read approved" ON public.competencies FOR SELECT TO authenticated
  USING ((is_active AND review_status IN ('approved','expert_reviewed')) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "competencies admin manage" ON public.competencies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_competencies_updated BEFORE UPDATE ON public.competencies FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. PREREQUISITES
CREATE TABLE public.competency_prerequisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_competency_id uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  to_competency_id uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  strength numeric NOT NULL DEFAULT 1.0,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_competency_id, to_competency_id),
  CHECK (from_competency_id <> to_competency_id)
);
ALTER TABLE public.competency_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_prereq read" ON public.competency_prerequisites FOR SELECT TO authenticated USING (true);
CREATE POLICY "comp_prereq admin manage" ON public.competency_prerequisites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. CURRICULUM SOURCES
CREATE TABLE public.curriculum_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('official_curriculum','exam_standard','university_syllabus','professional_framework','certification_framework','internal_expert','ai_generated_draft')),
  country_code text,
  url text,
  publisher text,
  version text,
  valid_from date,
  valid_to date,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.curriculum_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curr_sources read" ON public.curriculum_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "curr_sources admin manage" ON public.curriculum_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.competency_source_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id uuid NOT NULL REFERENCES public.competencies(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES public.curriculum_sources(id) ON DELETE CASCADE,
  source_ref text,
  confidence numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.competency_source_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comp_src_map read" ON public.competency_source_mappings FOR SELECT TO authenticated USING (true);
CREATE POLICY "comp_src_map admin manage" ON public.competency_source_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. BACKWARD COMPATIBILITY COLUMNS
ALTER TABLE public.knowledge_components ADD COLUMN IF NOT EXISTS competency_id uuid REFERENCES public.competencies(id) ON DELETE SET NULL;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS domain_id uuid REFERENCES public.learning_domains(id) ON DELETE SET NULL;
ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS education_level_id uuid REFERENCES public.education_levels(id) ON DELETE SET NULL;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Education systems
INSERT INTO public.education_systems (code, country_code, name_pl, name_en, name_es, description_pl, description_en, description_es) VALUES
('pl_national', 'PL', 'Polski system edukacji', 'Polish national education system', 'Sistema educativo nacional polaco', 'Edukacja w Polsce: szkoła podstawowa, średnia, matura.', 'Polish education: primary, secondary, matura.', 'Educación polaca: primaria, secundaria, matura.'),
('global_higher_ed', NULL, 'Globalna edukacja wyższa', 'Global higher education', 'Educación superior global', 'Studia licencjackie, magisterskie, doktoranckie.', 'Bachelor, master, PhD studies.', 'Estudios de grado, máster y doctorado.'),
('professional_reskilling', NULL, 'Przekwalifikowanie zawodowe', 'Professional reskilling', 'Reciclaje profesional', 'Ścieżki rozwoju zawodowego dla dorosłych.', 'Adult professional development pathways.', 'Trayectorias de desarrollo profesional para adultos.'),
('language_learning', NULL, 'Nauka języków obcych', 'Language learning', 'Aprendizaje de idiomas', 'Ramy CEFR i inne standardy językowe.', 'CEFR and other language frameworks.', 'Marco CEFR y otros estándares lingüísticos.');

-- Education levels
WITH s AS (SELECT id, code FROM public.education_systems)
INSERT INTO public.education_levels (education_system_id, code, name_pl, name_en, name_es, age_min, age_max, order_index) VALUES
((SELECT id FROM s WHERE code='pl_national'), 'pl_primary_1_3', 'Szkoła podstawowa 1–3', 'Primary school 1–3', 'Primaria 1–3', 7, 9, 10),
((SELECT id FROM s WHERE code='pl_national'), 'pl_primary_4_6', 'Szkoła podstawowa 4–6', 'Primary school 4–6', 'Primaria 4–6', 10, 12, 20),
((SELECT id FROM s WHERE code='pl_national'), 'pl_primary_7_8', 'Szkoła podstawowa 7–8', 'Primary school 7–8', 'Primaria 7–8', 13, 14, 30),
((SELECT id FROM s WHERE code='pl_national'), 'pl_secondary_1_2', 'Szkoła średnia 1–2', 'Secondary school 1–2', 'Secundaria 1–2', 15, 16, 40),
((SELECT id FROM s WHERE code='pl_national'), 'pl_secondary_3_4', 'Szkoła średnia 3–4', 'Secondary school 3–4', 'Secundaria 3–4', 17, 19, 50),
((SELECT id FROM s WHERE code='pl_national'), 'pl_matura_basic', 'Matura podstawowa', 'Matura basic', 'Matura básica', 18, 19, 60),
((SELECT id FROM s WHERE code='pl_national'), 'pl_matura_advanced', 'Matura rozszerzona', 'Matura advanced', 'Matura avanzada', 18, 19, 70),
((SELECT id FROM s WHERE code='global_higher_ed'), 'bachelor', 'Studia licencjackie', 'Bachelor', 'Grado', 18, 24, 10),
((SELECT id FROM s WHERE code='global_higher_ed'), 'master', 'Studia magisterskie', 'Master', 'Máster', 21, 27, 20),
((SELECT id FROM s WHERE code='global_higher_ed'), 'phd', 'Doktorat', 'PhD', 'Doctorado', 24, NULL, 30),
((SELECT id FROM s WHERE code='professional_reskilling'), 'beginner', 'Początkujący', 'Beginner', 'Principiante', NULL, NULL, 10),
((SELECT id FROM s WHERE code='professional_reskilling'), 'junior', 'Junior', 'Junior', 'Junior', NULL, NULL, 20),
((SELECT id FROM s WHERE code='professional_reskilling'), 'intermediate', 'Średniozaawansowany', 'Intermediate', 'Intermedio', NULL, NULL, 30),
((SELECT id FROM s WHERE code='professional_reskilling'), 'advanced', 'Zaawansowany', 'Advanced', 'Avanzado', NULL, NULL, 40),
((SELECT id FROM s WHERE code='professional_reskilling'), 'expert', 'Ekspert', 'Expert', 'Experto', NULL, NULL, 50),
((SELECT id FROM s WHERE code='language_learning'), 'cefr_a1', 'CEFR A1', 'CEFR A1', 'CEFR A1', NULL, NULL, 10),
((SELECT id FROM s WHERE code='language_learning'), 'cefr_a2', 'CEFR A2', 'CEFR A2', 'CEFR A2', NULL, NULL, 20),
((SELECT id FROM s WHERE code='language_learning'), 'cefr_b1', 'CEFR B1', 'CEFR B1', 'CEFR B1', NULL, NULL, 30),
((SELECT id FROM s WHERE code='language_learning'), 'cefr_b2', 'CEFR B2', 'CEFR B2', 'CEFR B2', NULL, NULL, 40),
((SELECT id FROM s WHERE code='language_learning'), 'cefr_c1', 'CEFR C1', 'CEFR C1', 'CEFR C1', NULL, NULL, 50),
((SELECT id FROM s WHERE code='language_learning'), 'cefr_c2', 'CEFR C2', 'CEFR C2', 'CEFR C2', NULL, NULL, 60);

-- Learning domains
INSERT INTO public.learning_domains (code, name_pl, name_en, name_es, domain_type) VALUES
('mathematics', 'Matematyka', 'Mathematics', 'Matemáticas', 'academic'),
('polish_language', 'Język polski', 'Polish language', 'Lengua polaca', 'language'),
('english_language', 'Język angielski', 'English language', 'Lengua inglesa', 'language'),
('programming', 'Programowanie', 'Programming', 'Programación', 'professional'),
('computer_science', 'Informatyka', 'Computer science', 'Informática', 'academic'),
('artificial_intelligence', 'Sztuczna inteligencja', 'Artificial intelligence', 'Inteligencia artificial', 'professional'),
('qa_automation', 'Automatyzacja QA', 'QA automation', 'Automatización QA', 'professional'),
('physics', 'Fizyka', 'Physics', 'Física', 'academic'),
('chemistry', 'Chemia', 'Chemistry', 'Química', 'academic'),
('biology', 'Biologia', 'Biology', 'Biología', 'academic'),
('history', 'Historia', 'History', 'Historia', 'academic'),
('economics', 'Ekonomia', 'Economics', 'Economía', 'academic'),
('business', 'Biznes', 'Business', 'Negocios', 'professional'),
('law', 'Prawo', 'Law', 'Derecho', 'university'),
('medicine', 'Medycyna', 'Medicine', 'Medicina', 'university'),
('research_methods', 'Metody badawcze', 'Research methods', 'Métodos de investigación', 'university');

-- Backward-compatibility mapping: math_7_9 subject -> mathematics domain + pl_primary_7_8 level
UPDATE public.subjects
SET domain_id = (SELECT id FROM public.learning_domains WHERE code='mathematics'),
    education_level_id = (SELECT el.id FROM public.education_levels el JOIN public.education_systems es ON es.id=el.education_system_id WHERE es.code='pl_national' AND el.code='pl_primary_7_8')
WHERE code='math_7_9';

-- Map base subjects (math, physics, etc.) to their academic domains (no level)
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='mathematics') WHERE code='math';
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='physics') WHERE code='physics';
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='chemistry') WHERE code='chemistry';
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='biology') WHERE code='biology';
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='computer_science') WHERE code='cs';
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='programming') WHERE code='programming';
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='english_language') WHERE code='english';
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='polish_language') WHERE code='polish';
UPDATE public.subjects SET domain_id = (SELECT id FROM public.learning_domains WHERE code='history') WHERE code='history';

-- Seed competencies from existing 21 math KCs (skip group "grp_*" KCs)
INSERT INTO public.competencies (domain_id, education_level_id, code, name_pl, name_en, name_es, difficulty_level, source_type, review_status)
SELECT
  (SELECT id FROM public.learning_domains WHERE code='mathematics'),
  (SELECT el.id FROM public.education_levels el JOIN public.education_systems es ON es.id=el.education_system_id WHERE es.code='pl_national' AND el.code='pl_primary_7_8'),
  kc.code,
  kc.name_pl,
  COALESCE(kc.name_en, kc.name_pl),
  kc.name_pl,
  GREATEST(1, LEAST(5, COALESCE(kc.difficulty_level, 1))),
  'manual',
  'approved'
FROM public.knowledge_components kc
JOIN public.subjects s ON s.id = kc.subject_id
WHERE s.code='math_7_9' AND kc.code NOT LIKE 'grp_%';

-- Link KCs back to competencies
UPDATE public.knowledge_components kc
SET competency_id = c.id
FROM public.competencies c
WHERE c.code = kc.code
  AND c.domain_id = (SELECT id FROM public.learning_domains WHERE code='mathematics')
  AND kc.subject_id = (SELECT id FROM public.subjects WHERE code='math_7_9');

-- Migrate existing kc_prerequisites to competency_prerequisites where mapping exists
INSERT INTO public.competency_prerequisites (from_competency_id, to_competency_id, strength, rationale)
SELECT DISTINCT kc_from.competency_id, kc_to.competency_id, kp.strength, 'Migrated from kc_prerequisites'
FROM public.kc_prerequisites kp
JOIN public.knowledge_components kc_from ON kc_from.id = kp.from_kc_id
JOIN public.knowledge_components kc_to ON kc_to.id = kp.to_kc_id
WHERE kc_from.competency_id IS NOT NULL
  AND kc_to.competency_id IS NOT NULL
  AND kc_from.competency_id <> kc_to.competency_id
ON CONFLICT (from_competency_id, to_competency_id) DO NOTHING;

-- Seed one curriculum source: Polish national core curriculum for math 7-8
INSERT INTO public.curriculum_sources (title, source_type, country_code, publisher, version, description) VALUES
('Podstawa programowa matematyki — szkoła podstawowa kl. 7–8', 'official_curriculum', 'PL', 'MEN', '2017', 'Polska podstawa programowa matematyki dla klas 7–8 szkoły podstawowej.');

-- Map all math_7_9 competencies to that source
INSERT INTO public.competency_source_mappings (competency_id, source_id, source_ref, confidence)
SELECT c.id, (SELECT id FROM public.curriculum_sources WHERE title LIKE 'Podstawa programowa matematyki%' LIMIT 1), c.code, 1.0
FROM public.competencies c
WHERE c.domain_id = (SELECT id FROM public.learning_domains WHERE code='mathematics')
  AND c.education_level_id = (SELECT el.id FROM public.education_levels el JOIN public.education_systems es ON es.id=el.education_system_id WHERE es.code='pl_national' AND el.code='pl_primary_7_8');
