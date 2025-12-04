import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalFilters } from "@/components/GlobalFilters";
import { useLocation } from "react-router-dom";

const PAGES_WITH_FILTERS = ["/dashboard", "/trades", "/reports", "/calendar", "/performance"];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const showFilters = PAGES_WITH_FILTERS.some(path => location.pathname.startsWith(path));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            {showFilters && <GlobalFilters />}
          </header>
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
