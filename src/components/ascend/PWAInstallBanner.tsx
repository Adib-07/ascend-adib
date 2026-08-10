import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("ascend_pwa_dismissed") === "true") {
      setDismissed(true);
      return;
    }
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setDismissed(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt || dismissed) return null;

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setDismissed(true);
      localStorage.setItem("ascend_pwa_dismissed", "true");
    }
    setPrompt(null);
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("ascend_pwa_dismissed", "true");
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-[200] animate-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-2xl p-4 flex items-start gap-3 bg-[var(--forest)] text-[var(--card)] shadow-[var(--shadow-lg)]">
        <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/20 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-[var(--gold)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-base leading-tight">Install Ascend</p>
          <p className="text-xs opacity-70 mt-0.5 leading-relaxed">
            Add it to your home screen for instant, app-like access.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={install}
              className="flex-1 py-2 px-3 bg-[var(--gold)] text-[var(--forest)] text-xs font-semibold rounded-lg hover:opacity-90 active:scale-95 transition-all"
            >
              Install App
            </button>
            <button
              onClick={dismiss}
              className="py-2 px-3 bg-white/10 text-xs rounded-lg hover:bg-white/20 active:scale-95 transition-all"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install banner"
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 opacity-60 hover:opacity-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
