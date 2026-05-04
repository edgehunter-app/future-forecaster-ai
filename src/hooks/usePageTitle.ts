import { useEffect } from "react";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — EdgeHunter`;
    return () => {
      document.title = "EdgeHunter";
    };
  }, [title]);
}

export default usePageTitle;