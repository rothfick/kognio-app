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
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

type Circle = { id: string; name: string; description: string | null; topic: string | null; max_members: number; created_by: string };

const Circles = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [desc, setDesc] = useState("");

  const load = async () => {
    const { data } = await supabase.from("circles").select("*").order("created_at", { ascending: false }).limit(50);
    setCircles((data as Circle[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!user || !name.trim()) return;
    const { data, error } = await supabase.from("circles").insert({
      name: name.trim(), description: desc.trim() || null, topic: topic.trim() || null, created_by: user.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      await supabase.from("circle_members").insert({ circle_id: data.id, user_id: user.id, role: "owner" });
    }
    toast.success("Krąg utworzony");
    setOpen(false); setName(""); setTopic(""); setDesc(""); load();
  };

  const join = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from("circle_members").insert({ circle_id: id, user_id: user.id });
    if (error) toast.error(error.message); else toast.success("Dołączono!");
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">{t("circles.title")}</h1>
            <p className="text-muted-foreground">{t("circles.subtitle")}</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent-gradient text-accent-foreground"><Plus className="h-4 w-4 mr-2" />{t("circles.create")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("circles.create")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Nazwa kręgu" value={name} onChange={(e) => setName(e.target.value)} />
                <Input placeholder="Temat (np. matura matematyka rozszerzona)" value={topic} onChange={(e) => setTopic(e.target.value)} />
                <Textarea placeholder="Opis" value={desc} onChange={(e) => setDesc(e.target.value)} />
                <Button onClick={create} className="w-full">Utwórz</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <p className="text-muted-foreground">{t("common.loading")}</p>
        ) : circles.length === 0 ? (
          <Card className="p-10 text-center bg-card-soft"><p className="text-muted-foreground">{t("circles.empty")}</p></Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {circles.map((c) => (
              <Card key={c.id} className="p-5 hover:shadow-elegant transition-smooth bg-card-soft">
                <div className="flex items-center gap-3 mb-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent/15 text-accent"><Users className="h-5 w-5" /></div>
                  <h3 className="font-semibold flex-1 truncate">{c.name}</h3>
                </div>
                {c.topic && <p className="text-sm text-accent font-medium mb-2">{c.topic}</p>}
                <p className="text-sm text-muted-foreground line-clamp-3 mb-4 min-h-[3rem]">{c.description || "—"}</p>
                <div className="flex gap-2">
                  <Button onClick={() => join(c.id)} className="flex-1" variant="outline">{t("circles.join")}</Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Circles;
