"use client";

import { useState } from "react";
import { Upload, FileVideo, ShieldCheck, Clock, CheckCircle2, XCircle, PlaySquare } from "lucide-react";

type CreativeStatus = "pending" | "approved" | "rejected";

interface Creative {
  id: string;
  name: string;
  uploadDate: string;
  status: CreativeStatus;
  linkedEvents: string[];
}

const mockCreatives: Creative[] = [
  {
    id: "c1",
    name: "Summer Blast 2026 - 15s",
    uploadDate: "Apr 10, 2026",
    status: "approved",
    linkedEvents: ["OVER_BREAK", "STRATEGIC_TIMEOUT"],
  },
  {
    id: "c2",
    name: "Hat-trick Special Animation",
    uploadDate: "Apr 12, 2026",
    status: "pending",
    linkedEvents: ["HAT_TRICK", "WICKET_FALL"],
  },
  {
    id: "c3",
    name: "Sixer Celebration Promo",
    uploadDate: "Apr 13, 2026",
    status: "rejected",
    linkedEvents: ["SIX_HIT", "HAT_TRICK_OF_SIXS"],
  },
];

const availableEvents = [
  "OVER_BREAK",
  "WICKET_FALL",
  "STRATEGIC_TIMEOUT",
  "LAST_OVER_THRILLER",
  "HAT_TRICK",
  "SIX_HIT",
  "HAT_TRICK_OF_SIXS",
];

export default function BrandCreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>(mockCreatives);
  const [selectedCreative, setSelectedCreative] = useState<Creative | null>(null);

  const getStatusIcon = (status: CreativeStatus) => {
    switch (status) {
      case "approved":
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case "pending":
        return <Clock className="w-4 h-4 text-[#90C2E7]" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-[#A31621]" />;
    }
  };

  const getStatusBadge = (status: CreativeStatus) => {
    switch (status) {
      case "approved":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">Greenlit</span>;
      case "pending":
        return <span className="bg-[#90C2E7]/10 text-[#4E8098] border border-[#90C2E7]/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">Under Review</span>;
      case "rejected":
        return <span className="bg-[#A31621]/10 text-[#A31621] border border-[#A31621]/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider">Rejected</span>;
    }
  };

  return (
    <div className="flex flex-col space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#CED3DC] pb-6 bg-white p-6 md:p-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-[#1a1a1a]">Promotional Material</h1>
          <p className="mt-2 text-sm text-[#4E8098] max-w-2xl">
            Upload your video creatives for upcoming matches. All materials are subject to review by the regulatory authority before they can be assigned to live event slots.
          </p>
        </div>
        <button className="bg-[#1a1a1a] hover:bg-[#333] text-white px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shrink-0">
          <Upload className="w-4 h-4" />
          Upload New Ad
        </button>
      </div>

      <div className="px-0 sm:px-6 grid lg:grid-cols-3 gap-6">
        
        {/* Creatives List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#FCF7F8] border border-[#CED3DC] p-4 flex gap-3 text-xs text-[#4E8098] mb-6">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#90C2E7]" />
            <p>Your uploaded creatives can be linked to multiple different match events (e.g. Hat-tricks, Strategic Timeouts). Only "Greenlit" ads will be shown by the broadcaster if you win the bid.</p>
          </div>

          <div className="grid gap-4">
            {creatives.map((c) => (
              <div 
                key={c.id} 
                onClick={() => setSelectedCreative(c)}
                className={`bg-white border p-5 cursor-pointer transition-colors hover:border-[#4E8098] ${selectedCreative?.id === c.id ? "border-[#4E8098] ring-1 ring-[#4E8098]" : "border-[#CED3DC]"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-16 bg-[#FCF7F8] flex flex-col items-center justify-center border border-[#CED3DC] group-hover:bg-[#1a1a1a] group-hover:text-white transition-colors">
                      <PlaySquare className="w-6 h-6 text-[#90C2E7]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-wide text-[#1a1a1a] flex items-center gap-2">
                        {c.name}
                      </h3>
                      <p className="text-[10px] uppercase font-mono tracking-widest text-[#4E8098] mt-1">Uploaded: {c.uploadDate}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(c.status)}
                    <span className="text-[10px] font-semibold text-[#4E8098] uppercase tracking-wider">{c.linkedEvents.length} Linked Events</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar / Detail Panel */}
        <div className="bg-white border border-[#CED3DC] p-6 lg:sticky lg:top-6 h-fit">
          {selectedCreative ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#1a1a1a] mb-1">Creative Details</h3>
                <p className="text-xs text-[#4E8098]">{selectedCreative.name}</p>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-[#FCF7F8] border border-[#CED3DC]">
                {getStatusIcon(selectedCreative.status)}
                <span className="text-xs font-semibold uppercase tracking-widest text-[#1a1a1a]">Status: {selectedCreative.status}</span>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#4E8098] mb-3">Linked Events</h4>
                {selectedCreative.linkedEvents.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedCreative.linkedEvents.map(evt => (
                      <span key={evt} className="px-2 py-1 bg-[#1a1a1a] text-white text-[10px] font-mono tracking-wider">
                        {evt.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#4E8098] italic">No events linked yet.</p>
                )}
              </div>

              <div className="h-px bg-[#CED3DC] w-full" />

              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#4E8098] mb-3">Manage Links</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {availableEvents.map(evt => {
                    const isLinked = selectedCreative.linkedEvents.includes(evt);
                    return (
                      <label key={evt} className="flex items-center gap-3 p-2 hover:bg-[#FCF7F8] cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isLinked}
                          readOnly
                          className="w-4 h-4 accent-[#1a1a1a]"
                        />
                        <span className="text-xs font-mono text-[#1a1a1a]">{evt.replace(/_/g, " ")}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button className="w-full bg-white border-2 border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white text-[#1a1a1a] px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors">
                Save Changes
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center h-48 space-y-4 text-[#4E8098]">
              <FileVideo className="w-8 h-8 opacity-50" />
              <p className="text-xs uppercase tracking-widest font-semibold">Select a creative to manage its event links</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}