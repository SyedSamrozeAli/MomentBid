"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Asterisk, Play } from "lucide-react";
import { setDemoAuthSession } from "@/lib/demoAuth";

export default function Home() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [platforms, setPlatforms] = useState<{ z: number; color: string; duration: number; delay: number }[]>([]);
  const router = useRouter();

  const handleAuthorizeLogin = () => {
    setError("");
    if (username === "kababjees" && password === "123") {
      setDemoAuthSession(username);
      router.replace("/brand");
      return;
    }

    setError("Invalid credentials. Use username kababjees and password 123.");
  };

  // Generate an abstract field of floating energy platforms
  useEffect(() => {
    // We create a grid. Most are dark/inactive. Some are Sakura Pink, some are PSL Emerald/Gold, some are Crimson.
    const newPlatforms = Array.from({ length: 400 }).map(() => {
      const rand = Math.random();
      let color = "rgba(255,255,255,0.03)";
      let baseZ = Math.random() * 20;

      if (rand > 0.96) {
        // Deep Crimson / Vermilion
        color = "rgba(230, 57, 70, 0.9)";
        baseZ = 60 + Math.random() * 60;
      } else if (rand > 0.90) {
        // Sakura Pink
        color = "rgba(255, 183, 197, 0.8)";
        baseZ = 40 + Math.random() * 40;
      } else if (rand > 0.88) {
        // PSL Emerald Green
        color = "rgba(16, 185, 129, 0.7)";
        baseZ = 50 + Math.random() * 30;
      } else if (rand > 0.86) {
        // PSL Gold
        color = "rgba(255, 215, 0, 0.6)"; 
        baseZ = 30 + Math.random() * 20;
      }

      return {
        z: baseZ,
        color,
        duration: 3 + Math.random() * 4,
        delay: Math.random() * -5,
      };
    });
    setPlatforms(newPlatforms);
  }, []);

  return (
    <>
      <style jsx global>{`
        :root {
          --bg-color: #08070A;
          --panel-bg: #0C0B0F;
          --sakura: #FFB7C5;
          --crimson: #E63946;
          --emerald: #10B981;
        }

        /* Prevent all scrolling */
        body, html {
          margin: 0;
          padding: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
          background-color: var(--bg-color);
        }

        /* 3D Global Space Drift */
        @keyframes abstractDrift {
          0% { transform: translate(-50%, -50%) rotateX(60deg) rotateZ(35deg) scale(0.9); }
          50% { transform: translate(-50%, -50%) rotateX(65deg) rotateZ(45deg) scale(1.05); }
          100% { transform: translate(-50%, -50%) rotateX(60deg) rotateZ(35deg) scale(0.9); }
        }

        .abstract-grid-container {
          position: absolute;
          top: 50%;
          left: 50%;
          transform-style: preserve-3d;
          animation: abstractDrift 30s ease-in-out infinite;
          /* Sizing relative to viewport to avoid overflow while maintaining aspect */
          width: 120vmin;
          height: 120vmin;
          display: grid;
          grid-template-columns: repeat(20, 1fr);
          grid-template-rows: repeat(20, 1fr);
          gap: 2px;
        }

        .float-platform {
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          transition: background-color 1s ease;
        }

        .glow-sakura {
          text-shadow: 0 0 10px rgba(255, 183, 197, 0.4);
        }
      `}</style>

      <div className="w-screen h-screen flex flex-col lg:flex-row overflow-hidden font-sans text-white relative selection:bg-[#FFB7C5]/30">
        
        {/* LEFT COMPONENT: Abstract Floating 3D Data Field */}
        <div className="absolute inset-0 lg:relative lg:flex-1 h-full overflow-hidden flex items-center justify-center opacity-30 lg:opacity-100 z-0">
          
          {/* Subtle Ambient Vignettes */}
          <div className="absolute top-[10%] left-[20%] w-[50vmin] h-[50vmin] bg-[#E63946]/10 blur-[100px] rounded-full" />
          <div className="absolute bottom-[20%] right-[30%] w-[60vmin] h-[60vmin] bg-[#FFB7C5]/10 blur-[120px] rounded-full" />

          {/* The true 3D floating grid */}
          <div className="relative w-full h-full perspective-[1500px]">
            <div className="abstract-grid-container">
              {platforms.map((p, i) => (
                <div 
                  key={i} 
                  className="float-platform"
                  style={{ 
                    backgroundColor: p.color,
                    // We animate the Z translation continuously to create a "breathing" / rippling effect
                    animation: `ripple hover ${p.duration}s ease-in-out infinite alternate`,
                    animationDelay: `${p.delay}s`,
                    transform: `translateZ(${p.z}px)`
                  }}
                />
              ))}
            </div>
          </div>

          {/* Minimalist Watermark Elements hidden deeply */}
          <div className="absolute left-[8%] bottom-[8%] flex flex-col gap-1 tracking-[0.4em] text-[10px] text-white/30 hidden md:flex">
             <span>SYS // MOMENTBID_CORE</span>
             <span>OP  // AUTO_ROUTING</span>
             <span className="text-[#FFB7C5]/60 mt-2">LIVE AUCTION ACTIVE</span>
          </div>
        </div>

        {/* RIGHT COMPONENT: Ultra Minimalist Japanese/Institutional Panel */}
        <div className="relative w-full lg:w-[460px] xl:w-[500px] h-full bg-[#0C0B0F]/80 backdrop-blur-3xl lg:border-l-[0.5px] lg:border-[#FFB7C5]/20 flex flex-col px-8 py-10 lg:px-12 lg:py-16 shrink-0 z-10">
          
          {/* Top Header - Squeezes slightly on short screens */}
          <div className="shrink-0 flex flex-col justify-start pb-6 border-b-[0.5px] border-white/10 min-h-0">
            <div className="flex items-center gap-3 mb-2">
              <Asterisk className="w-5 h-5 text-[#FFB7C5] animate-[spin_10s_linear_infinite]" />
              <span className="text-[10px] tracking-[0.2em] uppercase text-white/40">Secure Connection</span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-light tracking-[0.25em] glow-sakura mt-2">
              MOMENT<span className="font-bold">BID</span>
            </h1>
            <p className="text-[11px] text-[#10B981]/70 tracking-widest uppercase mt-4">
              Live Broadcast Finality Protocol
            </p>
          </div>

          {/* Middle Body - Expands/Shrinks dynamically */}
          <div className="flex-1 flex flex-col justify-center min-h-0 py-6">
            <div className="mb-6 text-[10px] text-white/40 tracking-[0.3em] font-light flex justify-between items-center px-1">
               <span>AUTHENTICATE CREDENTIALS</span>
               <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E63946] animate-pulse" />
                  <span>NODE OK</span>
               </div>
            </div>

            <div className="flex flex-col gap-4 min-h-0">
              <div className="relative w-full text-left p-4 shrink-0 transition-all duration-500 flex flex-col bg-white/[0.05] border-[1px] border-white/20 focus-within:border-[#FFB7C5] focus-within:bg-white/[0.08] rounded-sm shadow-sm">
                <label className="text-[9px] uppercase tracking-[0.2em] text-white/60 mb-2 font-semibold">IDENTIFIER // USERNAME</label>
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-[14px] tracking-widest font-bold text-white placeholder-white/40"
                  placeholder="ENTER USERNAME"
                />
              </div>

              <div className="relative w-full text-left p-4 shrink-0 transition-all duration-500 flex flex-col bg-white/[0.05] border-[1px] border-white/20 focus-within:border-[#FFB7C5] focus-within:bg-white/[0.08] rounded-sm shadow-sm">
                <label className="text-[9px] uppercase tracking-[0.2em] text-white/60 mb-2 font-semibold">PASSPHRASE // PASSWORD</label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-[14px] tracking-widest font-bold text-white placeholder-white/40"
                  placeholder="ENTER PASSWORD"
                />
              </div>

              {error && (
                <div className="text-[#E63946] text-[10px] tracking-widest uppercase mt-2 text-center animate-pulse">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer & Action - Shrinks slightly, fixed at bottom */}
          <div className="shrink-0 flex flex-col gap-6 pt-6 border-t-[0.5px] border-white/10 min-h-0">
             
            <div className="flex justify-between items-center px-1 text-[9px] tracking-[0.2em] font-mono text-white/30">
              <span>EST. LATENCY: <span className="text-white/60">12ms</span></span>
              <span>NET: <span className="text-[#10B981]">WIREFLUID</span></span>
            </div>

            <button
              type="button"
              onClick={handleAuthorizeLogin}
              className="group relative w-full h-[60px] bg-transparent border-[0.5px] border-[#FFB7C5]/50 overflow-hidden flex items-center justify-between px-6 transition-colors duration-500 hover:border-[#E63946] shrink-0"
            >
               
               {/* Hover Fill Effect */}
               <div className="absolute inset-0 bg-[#E63946] -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out z-0" />
               
               <span className="relative z-10 text-[11px] tracking-[0.4em] font-semibold text-white transition-colors duration-700">
                 AUTHORIZE LOGIN
               </span>
               
               <Play className="relative z-10 w-4 h-4 text-[#FFB7C5] transition-colors duration-700 group-hover:text-white fill-current" />
            </button>
            
          </div>
        </div>
      </div>
    </>
  );
}
