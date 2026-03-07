"use client";

import { useCallback, useEffect, useState } from "react";

interface MapHeightResult {
  height: number;
  isReady: boolean;
}

export function useMapHeight(): MapHeightResult {
  const [height, setHeight] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const measure = useCallback(() => {
    const navbar =
      document.querySelector("nav") ??
      document.querySelector("header") ??
      document.querySelector("[data-navbar]");

    const footer =
      document.querySelector("footer") ?? document.querySelector("[data-footer]");

    const navbarBottom = navbar ? navbar.getBoundingClientRect().bottom : 0;
    const footerTop = footer ? footer.getBoundingClientRect().top : window.innerHeight;
    const isMobile = window.innerWidth < 768;
    const mobileTabBar = isMobile ? 64 : 0;
    const gap = 16;

    const available = footerTop - navbarBottom - gap * 2 - mobileTabBar;
    setHeight(Math.max(available, 400));
    setIsReady(true);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      measure();
    });

    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return { height, isReady };
}
