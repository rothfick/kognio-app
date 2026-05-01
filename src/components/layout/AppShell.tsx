import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {t("common.footer", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
