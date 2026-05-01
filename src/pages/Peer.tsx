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
import { HandHelping, Plus, Check } from "lucide-react";
import { toast } from "sonner";

type Req = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  requester_id: string;
  helper_id: string | null;
  created_at: string;
};

const Peer = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [tab, setTab] = useState<"open" | "mine">("open");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("peer_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    setReqs((data as Req[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!user || !title.trim()) return;
    const { error } = await supabase.from("peer_requests").insert({ title: title.trim(), description: desc.trim() || null, requester_id: user.id });
    if (error) { toast.error(error.message); return; }
    toast.success(t("peer.published")); setOpen(false); setTitle(""); setDesc(""); load();
  };

  const offerHelp = async (r: Req) => {
    if (!user) return;
    if (r.requester_id === user.id) { toast.error(t("peer.ownRequest")); return; }
    const { error } = await supabase
      .from("peer_requests")
      .update({ helper_id: user.id, status: "matched" })
      .eq("id", r.id)
      .eq("status", "open");
    if (error) { toast.error(error.message); return; }
    toast.success(t("peer.helpOffered"));
    load();
  };

  const resolve = async (r: Req) => {
    const { error } = await supabase
      .from("peer_requests")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success(t("peer.resolvedToast"));
    load();
  };

  const visible = reqs.filter((r) => {
    if (tab === "open") return r.status === "open";
    if (!user) return false;
    return r.requester_id === user.id || r.helper_id === user.id;
  });

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
                <Input placeholder={t("peer.titlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
                <Textarea placeholder={t("peer.descPlaceholder")} value={desc} onChange={(e) => setDesc(e.target.value)} />
                <Button onClick={create} className="w-full">{t("peer.publish")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2 mb-6">
          <Button variant={tab === "open" ? "default" : "ghost"} size="sm" onClick={() => setTab("open")}>{t("peer.tabOpen")}</Button>
          <Button variant={tab === "mine" ? "default" : "ghost"} size="sm" onClick={() => setTab("mine")}>{t("peer.tabMine")}</Button>
        </div>

        {loading ? <p className="text-muted-foreground">{t("common.loading")}</p>
        : visible.length === 0 ? (
          <Card className="p-10 text-center bg-card-soft">
            <HandHelping className="h-10 w-10 mx-auto mb-3 text-accent" />
            <h3 className="font-semibold mb-2">
              {tab === "open" ? t("peer.emptyOpenTitle") : t("peer.emptyMineTitle")}
            </h3>
            <p className="text-muted-foreground mb-4">
              {tab === "open" ? t("peer.emptyOpenDesc") : t("peer.emptyMineDesc")}
            </p>
            <Button onClick={() => setOpen(true)} className="bg-accent-gradient text-accent-foreground">
              <Plus className="h-4 w-4 mr-2" />{t("peer.ask")}
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {visible.map((r) => {
              const isMine = user?.id === r.requester_id;
              const isHelper = user?.id === r.helper_id;
              return (
                <Card key={r.id} className="p-5 hover:shadow-soft transition-smooth bg-card-soft">
                  <div className="flex items-start gap-4">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent shrink-0"><HandHelping className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold">{r.title}</h3>
                        <Badge
                          variant={r.status === "open" ? "secondary" : r.status === "resolved" ? "default" : "outline"}
                          className="text-xs"
                        >
                          {r.status === "open" && t("peer.open")}
                          {r.status === "matched" && t("peer.matched")}
                          {r.status === "resolved" && t("peer.resolved")}
                        </Badge>
                        {isMine && <Badge variant="outline" className="text-xs">{t("peer.yourRequest")}</Badge>}
                        {isHelper && <Badge variant="outline" className="text-xs">{t("peer.youHelp")}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {r.status === "open" && !isMine && (
                        <Button variant="outline" size="sm" onClick={() => offerHelp(r)}>{t("peer.help")}</Button>
                      )}
                      {r.status === "matched" && (isMine || isHelper) && (
                        <Button variant="default" size="sm" onClick={() => resolve(r)}>
                          <Check className="h-4 w-4 mr-1" /> {t("peer.resolved")}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Peer;
