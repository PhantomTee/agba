"use client";
import { useEffect, useState } from "react";
import { GlobePreloader } from "./GlobePreloader";

export function IntroWrapper({ children }: { children: React.ReactNode }) {
  // Start visible — if intro should show we'll hide children after hydration
  const [showIntro, setShowIntro] = useState(false);
  const [childrenVisible, setChildrenVisible] = useState(true);

  useEffect(() => {
    const seen = sessionStorage.getItem("agba-intro-seen");
    if (!seen) {
      setShowIntro(true);
      setChildrenVisible(false);
    }
  }, []);

  function handleComplete() {
    sessionStorage.setItem("agba-intro-seen", "1");
    setShowIntro(false);
    setTimeout(() => setChildrenVisible(true), 50);
  }

  return (
    <>
      {showIntro && <GlobePreloader onComplete={handleComplete} />}
      <div style={{ opacity: childrenVisible ? 1 : 0, transition: "opacity 0.4s" }}>
        {children}
      </div>
    </>
  );
}
