
-- Chat na żywo w pokoju sesji
CREATE TABLE public.session_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'user', -- 'user' | 'ai'
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.session_chat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat read participants" ON public.session_chat
FOR SELECT TO authenticated
USING (public.is_session_participant(session_id, auth.uid()));

CREATE POLICY "chat insert participants" ON public.session_chat
FOR INSERT TO authenticated
WITH CHECK (public.is_session_participant(session_id, auth.uid()) AND auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_transcripts;
ALTER TABLE public.session_chat REPLICA IDENTITY FULL;
ALTER TABLE public.session_transcripts REPLICA IDENTITY FULL;

CREATE INDEX idx_chat_session ON public.session_chat(session_id, created_at);
