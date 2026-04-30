import { useEffect, useRef } from "react";
import { Tldraw, Editor, type TLStoreSnapshot, loadSnapshot, getSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { supabase } from "@/integrations/supabase/client";

type Props = { sessionId: string; userId: string };

/**
 * Współdzielona tablica tldraw + Supabase Realtime broadcast.
 * Snapshot-based sync: prosta i wystarczająca dla 2-6 osób.
 */
export const SharedWhiteboard = ({ sessionId, userId }: Props) => {
  const editorRef = useRef<Editor | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const applyingRemote = useRef(false);
  const lastSentAt = useRef(0);
  const sentInitial = useRef(false);

  const handleMount = (editor: Editor) => {
    editorRef.current = editor;

    const channel = supabase.channel(`board-${sessionId}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: "snapshot" }, ({ payload }) => {
      if (!payload?.snapshot || !editorRef.current) return;
      applyingRemote.current = true;
      try {
        loadSnapshot(editorRef.current.store, payload.snapshot as TLStoreSnapshot);
      } catch (e) {
        console.warn("[whiteboard] snapshot apply failed", e);
      } finally {
        setTimeout(() => { applyingRemote.current = false; }, 50);
      }
    });

    channel.on("broadcast", { event: "sync-request" }, ({ payload }) => {
      if (!editorRef.current || payload?.from === userId) return;
      const snapshot = getSnapshot(editorRef.current.store);
      channel.send({ type: "broadcast", event: "snapshot", payload: { snapshot } });
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !sentInitial.current) {
        sentInitial.current = true;
        channel.send({ type: "broadcast", event: "sync-request", payload: { from: userId } });
      }
    });

    const unlisten = editor.store.listen(
      () => {
        if (applyingRemote.current) return;
        const now = Date.now();
        if (now - lastSentAt.current < 250) return;
        lastSentAt.current = now;
        const snapshot = getSnapshot(editor.store);
        channel.send({ type: "broadcast", event: "snapshot", payload: { snapshot } });
      },
      { source: "user", scope: "document" }
    );

    return () => { unlisten(); };
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <Tldraw onMount={handleMount} />
    </div>
  );
};
