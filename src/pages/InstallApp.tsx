import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Smartphone, Apple, Share, Plus, QrCode } from "lucide-react";
import { detectBrowserPlatform } from "@/lib/platform";
import appIcon from "@/assets/app-icon.png";

export default function InstallApp() {
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    setPlatform(detectBrowserPlatform());
  }, []);

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    "https://edgehunter.net/install",
  )}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex flex-col items-center text-center gap-3">
        <img src={appIcon} alt="EdgeHunter" width={96} height={96} className="rounded-2xl shadow-lg" />
        <h1 className="text-2xl font-extrabold text-foreground">Get EdgeHunter on your device</h1>
        <p className="text-sm text-muted-foreground">Faster access, better performance, home-screen icon.</p>
      </header>

      {platform === "android" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="h-5 w-5 text-info" />
            <h2 className="text-lg font-bold">📱 Android App</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Download and install in 2 minutes.</p>
          <a
            href="/manifest.json"
            className="inline-flex w-full items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 text-sm font-bold text-white"
          >
            Download Android App
          </a>
          <ol className="mt-4 list-decimal pl-5 text-sm text-muted-foreground space-y-1">
            <li>Tap the button above</li>
            <li>Allow install from this source</li>
            <li>Open EdgeHunter from your home screen</li>
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Native APK coming soon. Meanwhile use your browser menu → "Install app".
          </p>
        </section>
      )}

      {platform === "ios" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Apple className="h-5 w-5 text-info" />
            <h2 className="text-lg font-bold">📱 iPhone App</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Coming to the App Store soon.</p>
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Meanwhile install as a Web App</div>
            <ol className="text-sm space-y-2">
              <li className="flex items-start gap-2"><Share className="h-4 w-4 mt-0.5 text-info" /> Tap the Share button in Safari</li>
              <li className="flex items-start gap-2"><Plus className="h-4 w-4 mt-0.5 text-info" /> Tap "Add to Home Screen"</li>
              <li className="flex items-start gap-2"><span className="text-info font-bold">✓</span> Tap "Add"</li>
            </ol>
          </div>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (notifyEmail) {
                localStorage.setItem("eh_ios_notify_email", notifyEmail);
                setNotified(true);
              }
            }}
          >
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button className="rounded-md bg-info px-4 py-2 text-sm font-bold text-white">
              {notified ? "✓ Saved" : "Notify me"}
            </button>
          </form>
        </section>
      )}

      {platform === "desktop" && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="h-5 w-5 text-info" />
            <h2 className="text-lg font-bold">Open on your phone</h2>
          </div>
          <div className="flex flex-col items-center gap-3">
            <img src={qrSrc} alt="QR code to edgehunter.net" width={200} height={200} className="rounded-lg bg-white p-2" />
            <p className="text-sm text-muted-foreground">Scan to open EdgeHunter on your phone, then follow the install steps.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs font-bold mb-1">📱 iPhone</div>
              <div className="text-[11px] text-muted-foreground">Safari → Share → Add to Home Screen</div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <div className="text-xs font-bold mb-1">🤖 Android</div>
              <div className="text-[11px] text-muted-foreground">Chrome menu → Install app</div>
            </div>
          </div>
        </section>
      )}

      <div className="text-center">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to app</Link>
      </div>
    </div>
  );
}