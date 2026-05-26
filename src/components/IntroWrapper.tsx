"use client";
import { useEffect, useState } from "react";
import { GlobePreloader } from "./GlobePreloader";

export function IntroWrapper({ children }: { children: React.ReactNode }) {
  const [showIntro, setShowIntro] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem("agba-intro-seen");
    if (!seen) {
      setShowIntro(true);
    }
    setReady(true);
  }, []);

  function handleComplete() {
    sessionStorage.setItem("agba-intro-seen", "1");
    setShowIntro(false);
  }

  if (!ready) return null;

  return (
    <>
      {showIntro && <GlobePreloader onComplete={handleComplete} />}
      <div style={{ opacity: showIntro ? 0 : 1, transition: "opacity 0.4s" }}>
        {children}
      </div>
    </>
  );
}
