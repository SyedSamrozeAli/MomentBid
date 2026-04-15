import { CircleDollarSign, ArrowUpRight, ArrowDownRight, Wallet, History, Lock, Unlock } from "lucide-react";

const topUpOptions = [250000, 500000, 1000000, 2000000];
const withdrawOptions = [150000, 300000, 750000];

const balanceState = {
  walletBalance: 4850000,
  escrowLocked: 2300000,
  withdrawable: 2550000,
  lastSettlement: "PKR 680,000 spent on LAST_OVER_THRILLER",
  walletAddress: "0x62A7...kababjees...9fE1",
};

const recentMoneyMoves = [
  {
    type: "Top Up",
    amount: 1000000,
    status: "Confirmed",
    context: "Pre-match funding for Karachi vs Lahore",
    icon: ArrowUpRight,
    color: "cyan",
  },
  {
    type: "Settlement",
    amount: -680000,
    status: "Finalized",
    context: "Slot 1 win on LAST_OVER_THRILLER",
    icon: ArrowDownRight,
    color: "indigo",
  },
  {
    type: "Refund",
    amount: 190000,
    status: "Claimable",
    context: "WICKET_FALL bid lost, full refund available",
    icon: ArrowUpRight,
    color: "emerald",
  },
];

function formatPKR(amount: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BalancePage() {
  return (
    <div className="flex flex-col space-y-8">
      
      {/* Header */}
      <header className="flex flex-col gap-4 md:flex-row md:items-end justify-between border-b border-[#CED3DC] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CircleDollarSign className="w-4 h-4 text-[#A31621]" />
            <p className="text-[10px] uppercase tracking-widest font-semibold text-[#A31621]/80">Brand Treasury</p>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">Balance & Vault</h2>
          <p className="mt-1 text-sm text-[#4E8098] max-w-xl">
            Manage your available liquidity and monitor escrow-locked funds committed to active bids.
          </p>
        </div>
        
        <div className="group border border-[#CED3DC] bg-white px-5 py-3 p-4 flex items-center gap-3 transition-colors hover:bg-[#FCF7F8]">
          <Wallet className="w-4 h-4 text-[#4E8098] group-hover:text-[#A31621] transition-colors" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#4E8098]/80 font-semibold">Connected Wallet</p>
            <p className="text-sm font-medium text-[#1a1a1a] font-mono transition-colors">
              {balanceState.walletAddress}
            </p>
          </div>
        </div>
      </header>

      {/* Overview Cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <WalletCard 
          title="Total Balance" 
          value={formatPKR(balanceState.walletBalance)} 
          tone="blue" 
          icon={<Wallet className="w-4 h-4" />} 
        />
        <WalletCard 
          title="Escrow Locked" 
          value={formatPKR(balanceState.escrowLocked)} 
          tone="red" 
          icon={<Lock className="w-4 h-4" />} 
        />
        <WalletCard 
          title="Withdrawable" 
          value={formatPKR(balanceState.withdrawable)} 
          tone="slate" 
          icon={<Unlock className="w-4 h-4" />} 
        />
      </section>

      {/* Transaction Actions */}
      <section className="grid gap-6 xl:grid-cols-2">
        <article className="border border-[#CED3DC] bg-white flex flex-col justify-between p-6 hover:bg-[#FCF7F8] transition-colors">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ArrowUpRight className="w-5 h-5 text-[#90C2E7]" />
              <h3 className="text-xl tracking-tight font-medium text-[#1a1a1a]">Deposit Capital</h3>
            </div>
            <p className="text-sm text-[#4E8098] mb-8 max-w-sm">
              Top up your vault to increase available budget.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {topUpOptions.map((amount) => (
              <button
                type="button"
                key={amount}
                className="group border border-[#CED3DC] bg-[#FCF7F8] px-4 py-3.5 transition-colors hover:border-[#90C2E7]/50 text-left hover:bg-white"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-[#4E8098] font-semibold mb-1 group-hover:text-[#90C2E7] transition-colors">Add Line</span>
                  <span className="text-sm font-semibold tracking-wide text-[#1a1a1a] group-hover:text-[#90C2E7] font-mono transition-colors">
                    {formatPKR(amount)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="border border-[#CED3DC] bg-white flex flex-col justify-between p-6 hover:bg-[#FCF7F8] transition-colors">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ArrowDownRight className="w-5 h-5 text-[#A31621]" />
              <h3 className="text-xl tracking-tight font-medium text-[#1a1a1a]">Withdraw Funds</h3>
            </div>
            <p className="text-sm text-[#4E8098] mb-8 max-w-sm">
              Withdraw available liquidity back to your connected wallet.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {withdrawOptions.map((amount) => (
              <button
                type="button"
                key={amount}
                className="group border border-[#CED3DC] bg-[#FCF7F8] px-4 py-3.5 transition-colors hover:border-[#A31621]/50 text-left hover:bg-white"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-[#4E8098] font-semibold mb-1 group-hover:text-[#A31621] transition-colors">Remove Line</span>
                  <span className="text-sm font-semibold tracking-wide text-[#1a1a1a] group-hover:text-[#A31621] font-mono transition-colors">
                    {formatPKR(amount)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>

      {/* Activity Log */}
      <section>
        <div className="flex items-center gap-3 mb-6 px-1">
          <History className="w-5 h-5 text-[#4E8098]" />
          <h3 className="text-lg font-medium text-[#1a1a1a]">Recent Ledger Activity</h3>
        </div>
        
        <div className="border border-[#CED3DC] bg-white overflow-hidden">
          <div className="divide-y divide-[#CED3DC]/50">
            {recentMoneyMoves.map((item, idx) => (
              <div key={`${item.type}-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4 hover:bg-[#FCF7F8] transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 border ${
                    item.color === 'cyan' ? 'bg-[#90C2E7]/10 border-[#90C2E7]/20 text-[#4E8098]' :
                    item.color === 'indigo' ? 'bg-[#FCF7F8] border-[#A31621]/20 text-[#A31621]' :
                    'bg-[#4E8098]/10 border-[#4E8098]/20 text-[#4E8098]'
                  }`}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-[#1a1a1a] flex items-center gap-2">
                      {item.type}
                      <span className="text-[9px] uppercase tracking-widest border border-[#CED3DC] bg-[#FCF7F8] px-2 py-0.5 rounded-none text-[#4E8098]">{item.status}</span>
                    </p>
                    <p className="mt-1 text-sm text-[#4E8098]">{item.context}</p>
                  </div>
                </div>
                <div className="text-left sm:text-right pl-14 sm:pl-0">
                  <p className={`text-lg font-mono font-medium ${item.amount >= 0 ? "text-[#90C2E7]" : "text-[#1a1a1a]"}`}>
                    {item.amount > 0 ? "+" : ""}{formatPKR(item.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function WalletCard({
  title,
  value,
  tone,
  icon,
}: {
  title: string;
  value: string;
  tone: "blue" | "red" | "slate" | "cyan" | "orange" | "emerald";
  icon: React.ReactNode;
}) {
  const tones = {
    blue: "text-[#90C2E7] bg-[#90C2E7]/10 border-[#90C2E7]/20",
    red: "text-[#A31621] bg-[#A31621]/10 border-[#A31621]/20",
    slate: "text-[#4E8098] bg-[#4E8098]/10 border-[#4E8098]/20",
    cyan: "text-[#90C2E7] bg-[#90C2E7]/10 border-[#90C2E7]/20",
    orange: "text-[#A31621] bg-[#A31621]/10 border-[#A31621]/20",
    emerald: "text-[#4E8098] bg-[#4E8098]/10 border-[#4E8098]/20",
  };

  return (
    <div className="group border border-[#CED3DC] bg-white p-6 transition-all hover:bg-[#FCF7F8]">
      <div className="flex items-start justify-between relative z-10 mb-4">
        <div className={`p-2.5 border ${tones[tone]}`}>
          {icon}
        </div>
      </div>
      
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4E8098] relative z-10">
        {title}
      </p>
      <p className="mt-1.5 text-2xl font-medium tracking-tight text-[#1a1a1a] relative z-10 font-mono">
        {value}
      </p>
    </div>
  );
}
