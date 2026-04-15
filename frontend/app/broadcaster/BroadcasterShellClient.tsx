"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Radio, Target, LogOut, Hexagon, Component, CircleDollarSign } from "lucide-react";
import { clearDemoAuthSession, hasDemoAuthSession } from "@/lib/demoAuth";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/broadcaster", label: "Studio Dashboard", icon: BarChart3 },
  { href: "/broadcaster/matches", label: "Manage Fixtures", icon: Radio },
  { href: "/broadcaster/exclusions", label: "Exclusion Config", icon: Component },
  { href: "/broadcaster/earnings", label: "Earnings & Fees", icon: CircleDollarSign },
];

export default function BroadcasterShellClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!hasDemoAuthSession("broadcaster_owner")) {
      router.replace("/");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FCF7F8] text-[#1a1a1a] selection:bg-[#90C2E7]/30 selection:text-[#1a1a1a] font-sans">
      <div className="flex w-full flex-col lg:flex-row min-h-screen">
        {/* Network Sidebar */}
        <aside className="w-full shrink-0 flex flex-col justify-between border-r border-[#CED3DC] bg-white lg:sticky lg:top-0 lg:h-screen lg:w-[260px]">
          <div>
            {/* Branding */}
            <div className="flex items-center gap-3 px-6 py-8 border-b border-[#CED3DC]">
              <Hexagon className="w-5 h-5 text-[#4E8098] stroke-[2]" />
              <div>
                <h1 className="text-sm font-semibold tracking-widest text-[#1a1a1a] uppercase">MomentBid</h1>
                <p className="text-[10px] uppercase tracking-widest text-[#4E8098] mt-0.5">Broadcaster Ops</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="mt-6 flex flex-col">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] mb-3 px-6">Broadcast Control</p>
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/broadcaster" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center justify-between border-l-2 px-6 py-3 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-[#4E8098] bg-[#90C2E7]/10 text-[#4E8098]"
                        : "border-transparent text-[#4E8098]/80 hover:bg-[#FCF7F8] hover:text-[#4E8098]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-4 h-4 ${isActive ? "text-[#4E8098]" : "text-[#4E8098]/60 group-hover:text-[#4E8098]"}`} />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Logout */}
          <div className="border-t border-[#CED3DC] bg-[#FCF7F8]">
            <div className="flex items-center gap-3 px-6 py-5">
              <div className="h-8 w-8 bg-white flex items-center justify-center border border-[#CED3DC]">
                <span className="text-[#4E8098] font-semibold text-[10px]">PT</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#1a1a1a] uppercase tracking-wider">PTV Sports</span>
                <span className="text-[10px] tracking-wider text-[#A31621] font-mono font-semibold">NETWORK ADMIN</span>
              </div>
            </div>
            <Link
              href="/"
              onClick={clearDemoAuthSession}
              className="flex w-full items-center justify-center gap-2 border-t border-[#CED3DC] bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#4E8098] transition-colors hover:bg-[#FCF7F8] hover:text-[#A31621]"
            >
              <LogOut className="w-3 h-3" />
              Disconnect Control
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-[#FCF7F8]">
          <div className="h-full w-full p-6 lg:p-12 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}