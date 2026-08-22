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
            <h2 className="text-7xl md:text-[9rem] font-black tracking-tighter text-white uppercase italic" style={{ textShadow: "5px 0px 15px rgba(0, 255, 255, 0.6), -5px 0px 15px rgba(255, 0, 60, 0.6), 4px 0 #00ffff, -4px 0 #ff003c" }}>
              CodeSense
            </h2>
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

        {/* Features Section */}
        <section className="px-6 py-20 bg-white/[0.02] border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard 
                icon={<Zap className="w-6 h-6 text-yellow-400" />}
                title="Lightning Fast"
                description="Compile and run C++, Python, Rust, Go and more instantly inside a secure Dockerized execution engine."
              />
              <FeatureCard 
                icon={<Brain className="w-6 h-6 text-purple-400" />}
                title="AI Code Analyst"
                description="Get real-time, multi-dimensional feedback scoring your code's Function, Design, Security, and Readability."
              />
              <FeatureCard 
                icon={<BookOpen className="w-6 h-6 text-blue-400" />}
                title="Auto-Documentation"
                description="Generate beautiful, comprehensive, and professional README files with a single click."
              />
              <FeatureCard 
                icon={<GitBranch className="w-6 h-6 text-gray-300" />}
                title="GitHub Integration"
                description="Seamlessly import your repositories, browse file trees, and edit projects directly in your browser."
              />
            </div>
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

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group">
      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-white">{title}</h3>
      <p className="text-gray-400 leading-relaxed text-sm">{description}</p>
    </div>
  );
}
