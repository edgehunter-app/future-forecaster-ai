import { Link } from "react-router-dom";
import { Eye } from "lucide-react";

export default function DemoBanner() {
  return (
    <div className="w-full bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-black shadow-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wide leading-tight">
              You're in Demo Mode
            </div>
            <div className="text-[11px] leading-tight opacity-80 truncate">
              Sign up free to save your bets and get tomorrow's edge.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/auth?mode=signup"
            className="inline-flex items-center rounded-md bg-black px-3 py-1.5 text-[11px] font-bold text-amber-300 hover:bg-black/90"
          >
            Create Free Account
          </Link>
          <Link
            to="/auth?mode=signin"
            className="inline-flex items-center rounded-md border border-black/60 px-3 py-1.5 text-[11px] font-bold text-black hover:bg-black/10"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}