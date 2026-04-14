import { Archive, History as HistoryIcon, FileText, Download, Check, AlertCircle } from "lucide-react";

type MatchHistory = {
  match: string;
  spend: number;
  refund: number;
  reservationFee: number;
  status: "Completed" | "Refund Pending";
};

const records: MatchHistory[] = [
  {
    match: "Karachi Kings vs Lahore Qalandars",
    spend: 2080000,
    refund: 390000,
    reservationFee: 10000,
    status: "Completed",
  },
  {
    match: "Peshawar Zalmi vs Quetta Gladiators",
    spend: 920000,
    refund: 240000,
    reservationFee: 12000,
    status: "Refund Pending",
  },
  {
    match: "Islamabad United vs Multan Sultans",
    spend: 1760000,
    refund: 0,
    reservationFee: 0,
    status: "Completed",
  },
];

function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function HistoryPage() {
  return (
    <div className="flex flex-col space-y-8">
      
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Archive className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]/80">Ledger Index</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">Settlement History</h2>
          <p className="mt-1 text-sm text-[#4E8098] max-w-xl">
            Cryptographically sealed match settlement records. Review spend velocity, reclaim un-triggered bid capital, and export invoices.
          </p>
        </div>
      </header>

      {/* Main Table */}
      <section>
        <div className="border border-[#CED3DC] bg-white overflow-hidden">
          <div className="p-6 border-b border-[#CED3DC] bg-[#FCF7F8] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HistoryIcon className="w-5 h-5 text-[#4E8098]" />
              <h3 className="text-lg font-medium text-[#1a1a1a]">Historical Fixtures</h3>
            </div>
            <button className="flex items-center justify-center gap-2 border border-[#CED3DC] bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#4E8098] transition-all hover:bg-[#FCF7F8] hover:text-[#1a1a1a]">
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#FCF7F8]">
                <tr className="text-[10px] uppercase tracking-widest text-[#4E8098] border-b border-[#CED3DC]">
                  <th className="px-6 py-4 font-semibold">Fixture</th>
                  <th className="px-6 py-4 font-semibold">Capital Deployed</th>
                  <th className="px-6 py-4 font-semibold">Escrow Refund</th>
                  <th className="px-6 py-4 font-semibold">Gas / Fees</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CED3DC]/50">
                {records.map((record) => (
                  <tr key={record.match} className="group transition-colors hover:bg-[#FCF7F8]">
                    <td className="px-6 py-5">
                      <span className="font-medium text-[#1a1a1a]">{record.match}</span>
                    </td>
                    <td className="px-6 py-5 font-mono text-[#1a1a1a]">{formatPKR(record.spend)}</td>
                    <td className="px-6 py-5 font-mono text-[#4E8098]">{formatPKR(record.refund)}</td>
                    <td className="px-6 py-5 font-mono text-[#4E8098]">{formatPKR(record.reservationFee)}</td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] uppercase tracking-widest font-semibold ${
                          record.status === "Completed"
                            ? "bg-[#4E8098]/10 text-[#4E8098] border-[#4E8098]/20"
                            : "bg-[#A31621]/10 text-[#A31621] border-[#A31621]/20"
                        }`}
                      >
                        {record.status === "Completed" && <Check className="w-3 h-3" />}
                        {record.status === "Refund Pending" && <AlertCircle className="w-3 h-3" />}
                        {record.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right flex items-center justify-end gap-2">
                      {record.status === "Refund Pending" ? (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center border border-[#A31621] bg-[#FCF7F8] px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-[#A31621] transition-all hover:bg-[#A31621]/10 hover:text-[#A31621]"
                        >
                          Claim Refund
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center border border-[#CED3DC] bg-white px-4 py-2 transition-all hover:bg-[#FCF7F8] hover:text-[#1a1a1a]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#4E8098]" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
