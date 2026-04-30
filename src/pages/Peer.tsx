import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { HandHelping, Plus } from "lucide-react";
import { toast } from "sonner";

type Req = { id: string; title: string; description: string | null; status: string; requester_id: string; created_at: string };

const Peer = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const load = async () => {
    const { data } = await supabase.from("peer_requests").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50);
    setReqs((data as Req[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("peer_requests").insert({ title: title.trim(), description: desc.trim() || null, requester_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Prośba opublikowana"); setOpen(false); setTitle(""); setDesc(""); load();
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t("peer.title")}</h1>
            <p className="text-muted-foreground">{t("peer.subtitle")}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-accent-gradient text-accent-foreground"><Plus className="h-4 w-4 mr-2" />{t("peer.ask")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("peer.ask")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Krótko: z czym potrzebujesz pomocy?" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder="Opisz problem szczegółowo" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <Button onClick={create} className="w-full">Opublikuj</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? <p className="text-muted-foreground">{t("common.loading")}</p>
        : reqs.length === 0 ? (
          <Card className="p-10 text-center bg-card-soft"><p className="text-muted-foreground">{t("peer.empty")}</p></Card>
        ) : (
          <div className="space-y-3">
            {reqs.map((r) => (
              <Card key={r.id} className="p-5 hover:shadow-soft transition-smooth bg-card-soft">
                <div className="flex items-start gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent shrink-0"><HandHelping className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold">{r.title}</h3>
                      <Badge variant="secondary" className="text-xs">{t("peer.open")}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                  </div>
                  <Button variant="outline" size="sm">Pomogę</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Peer;
