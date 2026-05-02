import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Building2, Loader2, Plus, ExternalLink, Pause, Archive, Play } from "lucide-react";

type OrgStatus = "active" | "paused" | "archived";
type OrgKind = "school" | "training_company";
interface OrgRow {
  id: string;
  name: string;
  slug: string;
  org_type: OrgKind;
  status: OrgStatus;
  country_code: string | null;
  billing_email: string | null;
  description: string | null;
  is_verified: boolean;
  owner_id: string;
  created_at: string;
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
}

export default function AdminOrganizations() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  // Create-form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [orgType, setOrgType] = useState<OrgKind>("school");
  const [country, setCountry] = useState("PL");
  const [billing, setBilling] = useState("");
  const [description, setDescription] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("organizations")
      .select("id,name,slug,org_type,status,country_code,billing_email,description,is_verified,owner_id,created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data || []) as OrgRow[]);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, []);

  const onCreate = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error(t("adminOrgs.nameRequired")); return; }
    setWorking(true);
    const finalSlug = (slug.trim() || slugify(name)) + "-" + Math.random().toString(36).slice(2, 6);
    const { error } = await supabase.from("organizations").insert({
      name: name.trim(),
      slug: finalSlug,
      org_type: orgType,
      country_code: country.trim().toUpperCase() || null,
      billing_email: billing.trim() || null,
      description: description.trim() || null,
      owner_id: user.id,
      created_by: user.id,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("adminOrgs.created"));
    setOpen(false);
    setName(""); setSlug(""); setBilling(""); setDescription("");
    void refresh();
  };

  const setStatus = async (id: string, status: OrgStatus) => {
    const { error } = await supabase.from("organizations").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(t(`adminOrgs.statusChanged.${status}`));
    void refresh();
  };

  return (
    <AdminPageShell
      title={t("adminOrgs.title")}
      subtitle={t("adminOrgs.subtitle")}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />{t("adminOrgs.create")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("adminOrgs.create")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("adminOrgs.fields.name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label>{t("adminOrgs.fields.type")}</Label>
                <Select value={orgType} onValueChange={(v) => setOrgType(v as OrgKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">{t("adminOrgs.type.school")}</SelectItem>
                    <SelectItem value="training_company">{t("adminOrgs.type.training_company")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("adminOrgs.fields.country")}</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={3} />
                </div>
                <div>
                  <Label>{t("adminOrgs.fields.slug")}</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto" />
                </div>
              </div>
              <div>
                <Label>{t("adminOrgs.fields.billingEmail")}</Label>
                <Input value={billing} onChange={(e) => setBilling(e.target.value)} type="email" />
              </div>
              <div>
                <Label>{t("adminOrgs.fields.description")}</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={onCreate} disabled={working}>
                {working && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("adminOrgs.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {loading ? (
        <div className="text-sm text-muted-foreground py-8">{t("common.loadingPanel")}</div>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">{t("adminOrgs.empty")}</Card>
      ) : (
        <div className="space-y-2">
          {rows.map((o) => (
            <Card key={o.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{o.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {t(`adminOrgs.type.${o.org_type}`)} · {o.country_code || "—"} · {o.slug}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                <Badge variant={o.status === "active" ? "default" : o.status === "paused" ? "secondary" : "outline"}>
                  {t(`adminOrgs.status.${o.status}`)}
                </Badge>
                {o.status !== "active" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, "active")}>
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                {o.status === "active" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, "paused")}>
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                {o.status !== "archived" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus(o.id, "archived")}>
                    <Archive className="h-4 w-4" />
                  </Button>
                )}
                <Button asChild size="sm" variant="outline" className="gap-1">
                  <Link to={`/org/${o.id}`}>{t("adminOrgs.open")} <ExternalLink className="h-3 w-3" /></Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminPageShell>
  );
}
