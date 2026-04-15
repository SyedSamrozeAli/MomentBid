"use client";

import { Bell, AlertTriangle, ShieldAlert } from "lucide-react";

function HardcodedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-[#A31621] border border-[#A31621]/30 px-2 py-1 bg-[#FCF7F8]">
      <AlertTriangle className="w-3 h-3" /> Hardcoded
    </span>
  );
}

export default function AdminAlertsPage() {
  return (
    <div className="p-6 md:p-10 space-y-8 pb-20">
      <div>
        <h2 className="text-3xl font-medium tracking-tight text-[#1a1a1a]">Network Alerts</h2>
        <p className="mt-1 text-sm text-[#4E8098]">Alert stream UI remains visible with hardcoded preview data while backend integration is pending for this page.</p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="w-3 h-3" />
              Critical Alerts
            </span>
            <HardcodedBadge />
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">1</p>
        </div>

        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              Warning Alerts
            </span>
            <HardcodedBadge />
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">3</p>
        </div>

        <div className="bg-white border border-[#CED3DC] p-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[#4E8098] mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-3 h-3" />
              Informational Alerts
            </span>
            <HardcodedBadge />
          </p>
          <p className="text-3xl font-light text-[#1a1a1a]">12</p>
        </div>
      </section>

      <section className="bg-white border border-[#CED3DC] overflow-hidden">
        <div className="p-5 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide uppercase text-[#1a1a1a]">Alert Feed Preview</h3>
          <HardcodedBadge />
        </div>
        <div className="p-5 space-y-3">
          <div className="border border-[#CED3DC] p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#A31621]">Critical | 10:04:11</p>
            <p className="mt-2 text-sm text-[#1a1a1a]">Oracle heartbeat exceeded threshold on shard-2.</p>
          </div>
          <div className="border border-[#CED3DC] p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#4E8098]">Warning | 10:06:27</p>
            <p className="mt-2 text-sm text-[#1a1a1a]">Pending settlements queue length exceeded advisory limit.</p>
          </div>
          <div className="border border-[#CED3DC] p-4">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#4E8098]">Info | 10:08:02</p>
            <p className="mt-2 text-sm text-[#1a1a1a]">New broadcaster wallet synchronized successfully.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
