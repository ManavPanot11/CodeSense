import MarketingNav from "../components/MarketingNav";
import { TerminalSquare, Activity, FileText, DownloadCloud } from "lucide-react";

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 selection:text-primary-light flex flex-col font-sans">
      <MarketingNav />

      <main className="flex-1 flex flex-col items-center py-20 px-6 max-w-4xl mx-auto w-full">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-white">
            How CodeSense Works.
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            A seamless developer experience designed to keep you in the flow.
          </p>
        </div>

        <div className="space-y-12 relative before:absolute before:inset-0 before:ml-6 md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:via-primary/20 before:to-transparent">
          
          <Step
            number="1"
            icon={<TerminalSquare className="w-5 h-5 text-black" />}
            title="Write & Execute Securely"
            description="Type your code in the world-class Monaco editor. Whether it's C++, Python, or Rust, clicking 'Run' sends your code (along with any Standard Input) to the Piston API. Your logic is compiled and executed instantly in an isolated, secure Docker container, returning the output directly to your console."
          />

          <Step
            number="2"
            icon={<Activity className="w-5 h-5 text-black" />}
            title="Real-Time AI Analysis"
            description="As you type, CodeSense automatically analyzes your active file. Our custom AI prompt evaluates your code across four dimensions: Function, Design, Security, and Readability. It highlights critical errors and suggests actionable areas of improvement without altering your original code."
          />

          <Step
            number="3"
            icon={<FileText className="w-5 h-5 text-black" />}
            title="Instant Documentation"
            description="Stop wasting time writing manual documentation. Click the 'Download Docs' button, and CodeSense will use our dedicated LLM pipeline to generate a highly detailed, professional README.md file customized perfectly to your specific code's architecture and logic."
          />

          <Step
            number="4"
            icon={<DownloadCloud className="w-5 h-5 text-black" />}
            title="Import & Export Anywhere"
            description="Log in with GitHub to instantly pull any repository into your local browser workspace. When you're done coding, use the 'Download Workspace' button to package your entire virtual file system into a physical ZIP file, complete with your auto-generated documentation."
          />

        </div>
      </main>

      <footer className="py-8 text-center text-sm text-gray-600 border-t border-white/5 bg-black">
        <p>&copy; {new Date().getFullYear()} CodeSense. All rights reserved.</p>
      </footer>
    </div>
  );
}

function Step({ number, icon, title, description }: { number: string, icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group w-full">
      <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-black bg-primary z-10 shrink-0 md:mx-auto shadow-[0_0_20px_-5px_rgba(251,191,36,0.5)]">
        {icon}
      </div>
      
      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors ml-4 md:ml-0 text-left">
        <div className="text-primary-light font-black mb-1 opacity-50">STEP {number}</div>
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
