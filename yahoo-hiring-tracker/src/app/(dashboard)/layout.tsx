"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  BookOpen,
  ShieldCheck,
  Users,
  Menu,
  ChevronLeft,
  GitBranch,
} from "lucide-react";

const navItems = [
  { href: "/fulfillment", label: "Fulfillment", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/stale", label: "Stale Reports", icon: AlertTriangle },
  { href: "/reference", label: "Reference", icon: BookOpen },
  { href: "/compliance", label: "Compliance", icon: ShieldCheck },
  { href: "/candidates", label: "Candidates", icon: Users },
];

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-l-2 border-[#204ECF] bg-white/10 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-[#204ECF]")} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-[#0F172A] text-white transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        <div className={cn("flex items-center h-14 px-3", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <Link href="/fulfillment" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-[#204ECF] flex items-center justify-center">
                <span className="text-white text-xs font-bold">Y!</span>
              </div>
              <span className="font-semibold text-sm text-white">Hiring Tracker</span>
            </Link>
          )}
          {collapsed && (
            <div className="h-7 w-7 rounded-md bg-[#204ECF] flex items-center justify-center">
              <span className="text-white text-xs font-bold">Y!</span>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10"
              onClick={() => setCollapsed(true)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mx-3 border-t border-white/10" />
        <div className="flex-1 overflow-y-auto py-3">
          <SidebarNav collapsed={collapsed} />
        </div>
        {collapsed && (
          <div className="p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-white/10 w-full"
              onClick={() => setCollapsed(false)}
            >
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-56 p-0 bg-[#0F172A] text-white border-none">
          <div className="flex items-center h-14 px-4">
            <Link
              href="/fulfillment"
              className="flex items-center gap-2"
              onClick={() => setMobileOpen(false)}
            >
              <div className="h-7 w-7 rounded-md bg-[#204ECF] flex items-center justify-center">
                <span className="text-white text-xs font-bold">Y!</span>
              </div>
              <span className="font-semibold text-sm text-white">Hiring Tracker</span>
            </Link>
          </div>
          <div className="mx-3 border-t border-white/10" />
          <div className="py-3">
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="flex items-center h-14 border-b px-4 gap-3 bg-card">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            Yahoo Hiring Tracker
          </span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
