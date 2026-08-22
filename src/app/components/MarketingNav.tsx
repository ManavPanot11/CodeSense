import Link from "next/link";
import { Terminal, ChevronRight } from "lucide-react";

export default function MarketingNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 md:px-12 md:py-6 border-b border-white/5">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/20">
          <Terminal className="w-4 h-4 text-black" />
        </div>
        <Link href="/" className="text-xl font-black tracking-tighter">CodeSense</Link>
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
