"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";
import { Button } from "./Button";
import { NAV_LINKS } from "@/lib/site-content";
import styles from "./Nav.module.css";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <header className={styles.header} data-scrolled={scrolled || menuOpen}>
      <div className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label="Ledger home">
          <Logo height={32} />
        </Link>

        <nav className={styles.links} aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Button href="/demo">Open the demo</Button>
        </div>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span data-open={menuOpen} />
          <span data-open={menuOpen} />
        </button>
      </div>

      {menuOpen ? (
        <div className={styles.mobilePanel}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Button href="/demo" size="lg" className={styles.mobileCta}>
            Open the demo
          </Button>
        </div>
      ) : null}
    </header>
  );
}
