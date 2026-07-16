import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

export interface DemoGateSheetProps {
  open: boolean;
  onClose: () => void;
  feature?: string;
}

export default function DemoGateSheet({ open, onClose, feature }: DemoGateSheetProps) {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-lg font-extrabold text-foreground">
              This feature requires an account
            </div>
            {feature && (
              <div className="mt-1 text-xs text-muted-foreground">{feature}</div>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Sign up free — takes 30 seconds. No credit card required.
        </p>
        <div className="mt-5 space-y-2">
          <button
            onClick={() => { onClose(); navigate("/auth?mode=signup"); }}
            className="w-full min-h-[44px] rounded-md bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-bold text-white hover:opacity-95"
          >
            Create Free Account
          </button>
          <button
            onClick={onClose}
            className="w-full min-h-[44px] rounded-md border border-border bg-transparent px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}