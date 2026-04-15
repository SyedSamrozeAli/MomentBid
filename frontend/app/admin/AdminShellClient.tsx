"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Activity, Bell, LayoutDashboard, LogOut, Code, AlertTriangle, ShieldAlert, Cpu } from "lucide-react";
import { clearDemoAuthSession, getCurrentAuthUser, hasDemoAuthSession } from "@/lib/demoAuth";

export default function AdminShellClient({ children }: { children: React.ReactNode }) {
  // Navigation Shell State
  const [session, setSession] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!hasDemoAuthSession("admin")) {
      router.replace("/");
      return;
    }

    const user = getCurrentAuthUser();
    if (user) {
      setSession(user.username);
    } else {
      setSession("admin");
    }
  }, [router]);

  if (!session) {
    return <div className="min-h-screen bg-[#08070A] flex items-center justify-center"><p className="text-white font-mono text-xs tracking-widest animate-pulse">VERIFYING CREDENTIALS...</p></div>;
  }

  const handleLogout = () => {
    clearDemoAuthSession();
    router.replace("/");
  };

  const navLinks = [
    { name: "Observation Deck", href: "/admin", icon: LayoutDashboard },
    { name: "Oracle Simulator", href: "/admin/simulator", icon: Activity },
    { name: "Protocol Config", href: "/admin/protocol", icon: Code },
    { name: "Network Alerts", href: "/admin/alerts", icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen bg-[#FCF7F8] flex flex-col md:flex-row font-sans selection:bg-[#4E8098]/20">
      <aside className="w-full md:w-[280px] bg-[#1a1a1a] text-white flex flex-col border-r border-[#1a1a1a] shrink-0 sticky top-0 md:h-screen z-20">
        <div className="p-6 md:p-8 flex items-center gap-3">
           <Cpu className="w-6 h-6 text-[#A31621]" />
           <div>
             <h1 className="text-lg font-light tracking-[0.25em] text-white">MOMENT<span className="font-bold">BID</span></h1>
             <p className="text-[10px] text-[#A31621] uppercase tracking-widest font-semibold mt-1">Platform Admin</p>
           </div>
        </div>

        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          <p className="px-4 text-[10px] uppercase font-bold tracking-widest text-white/40 mb-2">Network Control</p>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
               <Link
                 key={link.name}
                 href={link.href}
                 className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors group ${
                   isActive ? "bg-white/10 text-white font-medium border-l-2 border-[#A31621]" : "text-white/60 hover:bg-white/5 hover:text-white border-l-2 border-transparent"
                 }`}
               >
                 <Icon className={`w-4 h-4 ${isActive ? "text-[#A31621]" : "text-white/40 group-hover:text-white/80"}`} />
                 <span className="tracking-wide">{link.name}</span>
               </Link>
            )
          })}
        </nav>

        <div className="p-6 border-t border-white/10">
          <button 
             onClick={handleLogout}
             className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-transparent border border-white/20 text-[#FCF7F8]/80 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
          >
             <LogOut className="w-4 h-4" /> Terminate Session
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 md:h-20 bg-white border-b border-[#CED3DC] flex items-center justify-between px-6 md:px-10 sticky top-0 z-10 shrink-0">
           <div className="flex items-center gap-4">
             <span className="text-[10px] uppercase tracking-widest font-bold text-[#1a1a1a] bg-[#FCF7F8] px-3 py-1.5 border border-[#CED3DC]">
               System Status: <span className="text-[#4E8098] ml-1">OPTIMAL</span>
             </span>
           </div>
           
           <div className="flex items-center gap-6">
              <button className="relative text-[#1a1a1a] hover:text-[#4E8098] transition-colors">
                 <Bell className="w-5 h-5" />
                 <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#A31621] rounded-full border-2 border-white"></span>
              </button>
              
              <div className="flex items-center gap-3 pl-6 border-l border-[#CED3DC]">
                 <div className="w-8 h-8 bg-[#A31621] flex items-center justify-center text-white text-xs font-bold font-mono">
                    AD
                 </div>
                 <div className="hidden sm:block text-sm">
                    <p className="font-semibold text-[#1a1a1a]">SYS_ROOT</p>
                    <p className="text-[10px] text-[#4E8098] font-mono">0x1a7F...c3b4</p>
                 </div>
              </div>
           </div>
        </header>

        <main className="flex-1 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}