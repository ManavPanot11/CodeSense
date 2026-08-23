import Link from "next/link";
import { Zap, Brain, BookOpen, GitBranch } from "lucide-react";
import MarketingNav from "./components/MarketingNav";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 selection:text-primary-light flex flex-col font-sans">
      <MarketingNav />

      {/* Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="relative px-6 py-24 md:py-32 flex flex-col items-center justify-center text-center max-w-5xl mx-auto z-10 overflow-hidden">
          {/* Cyan/Dark Volume & Lighting Effects */}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/30 via-black to-black opacity-90"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-2 text-gray-300 leading-tight">
            The Intelligent <br /> Code Sandbox.
          </h1>
          
          <div className="mb-10 select-none pointer-events-none drop-shadow-2xl">
            <img 
              src="/logo.png" 
              alt="CodeSense" 
              className="h-24 md:h-32 lg:h-48 object-contain drop-shadow-[0_0_15px_rgba(0,255,255,0.4)]"
            />
          </div>
          
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mb-12 leading-relaxed font-light drop-shadow-md">
            Write, compile, and execute code in over a dozen languages instantly. 
            Powered by next-generation AI to analyze your logic, pinpoint bugs, and generate professional documentation.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/editor"
              className="flex items-center justify-center gap-2 bg-cyan-400 text-black px-10 py-4 rounded-full text-lg font-bold hover:bg-cyan-300 transition-all hover:scale-105 duration-300 shadow-[0_0_40px_-10px_rgba(34,211,238,0.5)] w-full sm:w-auto"
            >
              Start Coding Now
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-sm text-gray-600 border-t border-white/5 bg-black">
        <p>&copy; {new Date().getFullYear()} CodeSense. All rights reserved.</p>
      </footer>
    </div>
  );
}

