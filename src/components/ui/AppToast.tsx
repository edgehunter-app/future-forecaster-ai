import { Toaster as SonnerToaster, toast } from "sonner";

export type ToastType = "success" | "error" | "info";

export function ToastContainer() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: "hsl(var(--card))",
          border: "1px solid hsl(var(--border))",
          color: "hsl(var(--foreground))",
        },
      }}
    />
  );
}

export function useToast() {
  return {
    showToast: (message: string, type: ToastType = "info") => {
      if (type === "success") toast.success(message);
      else if (type === "error") toast.error(message);
      else toast(message);
    },
  };
}

export default ToastContainer;
