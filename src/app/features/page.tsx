import MarketingNav from "../components/MarketingNav";
import { Zap, Brain, BookOpen, GitBranch, Code, Server, Database, Lock } from "lucide-react";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 selection:text-primary-light flex flex-col font-sans">
      <MarketingNav />

      <main className="flex-1 flex flex-col items-center py-20 px-6 max-w-5xl mx-auto w-full">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-white">
            Powerful Features. <br className="hidden md:block"/> Modern Tech Stack.
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            CodeSense is built using cutting-edge technologies to deliver a desktop-class development environment directly in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          
          <FeatureCard 
            icon={<Code className="w-6 h-6 text-emerald-400" />}
            title="Next.js & React"
            description="Built on Next.js 16 (App Router) and React 19 for instantaneous client-side rendering and blazing fast serverless API routes."
          />
          <FeatureCard 
            icon={<Brain className="w-6 h-6 text-purple-400" />}
            title="OpenRouter & Gemini"
            description="The AI Code Analyst and Documentation features are powered by high-speed LLMs accessed via OpenRouter, utilizing a customized multi-dimensional JSON schema."
          />
          <FeatureCard 
            icon={<Server className="w-6 h-6 text-blue-400" />}
            title="Piston Execution Engine"
            description="Instead of relying on LLM hallucinations, code is compiled and executed in real-time inside secure, isolated Docker containers via the Piston API."
          />
          <FeatureCard 
            icon={<Database className="w-6 h-6 text-yellow-400" />}
            title="IndexedDB Persistence"
            description="Your workspace, file tree, and unsaved changes are persisted entirely locally in your browser using idb-keyval. No central database needed."
          />
          <FeatureCard 
            icon={<GitBranch className="w-6 h-6 text-gray-300" />}
            title="GitHub Octokit Integration"
            description="Seamlessly authenticate with NextAuth.js to import public or private GitHub repositories directly into your local workspace."
          />
          <FeatureCard 
            icon={<Lock className="w-6 h-6 text-red-400" />}
            title="Monaco Editor"
            description="The exact same editing engine that powers VS Code (@monaco-editor/react), providing syntax highlighting, autocomplete, and native keybinding support."
          />
          <FeatureCard 
            icon={<Zap className="w-6 h-6 text-orange-400" />}
            title="Tailwind CSS"
            description="Styled completely with Tailwind CSS v4, enabling the sleek, responsive, and highly customizable dark mode aesthetics you see here."
          />
          <FeatureCard 
            icon={<BookOpen className="w-6 h-6 text-pink-400" />}
            title="JSZip Exports"
            description="Download your entire virtual workspace into a physical .zip file effortlessly. Perfect for backing up your work or moving to a local IDE."
          />

        </div>
      </main>

      <footer className="py-8 text-center text-sm text-gray-600 border-t border-white/5 bg-black">
        <p>&copy; {new Date().getFullYear()} CodeSense. All rights reserved.</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors flex flex-col items-start text-left">
      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}
