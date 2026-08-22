import Link from "next/link";
import { Terminal, ChevronRight } from "lucide-react";

export default function MarketingNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 md:px-12 md:py-6 border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <Link href="/" className="text-2xl font-black tracking-tighter text-white" style={{ textShadow: "2px 0 #00ffff, -2px 0 #ff003c" }}>
          CodeSense
        </Link>
      </div>
      
      <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-300">
        <Link href="/features" className="hover:text-white transition-colors">Features</Link>
        <Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/editor"
          className="group flex items-center gap-2 bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-all duration-300 shadow-xl"
        >
          Open Editor
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </nav>
  );
}
