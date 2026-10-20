import type { ReactNode } from "react";
import { Logo } from "./Logo";
import styles from "./AppWindow.module.css";

interface AppWindowProps {
  url?: string;
  children: ReactNode;
  className?: string;
}

export function AppWindow({ url = "app.ledger.co", children, className }: AppWindowProps) {
  return (
    <div className={[styles.window, className].filter(Boolean).join(" ")}>
      <div className={styles.chrome}>
        <span className={styles.url}>
          <Logo variant="mark" height={14} />
          {url}
        </span>
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
