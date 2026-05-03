import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="page-fade p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
