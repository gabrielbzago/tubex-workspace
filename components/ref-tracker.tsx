"use client";

import { useEffect } from "react";

export default function RefTracker() {

  useEffect(() => {

    const params = new URLSearchParams(
      window.location.search
    );

    const ref = params.get("ref");

    if (!ref) return;

    // Salva o código do afiliado para ser utilizado no checkout
    localStorage.setItem(
      "affiliate_ref",
      ref
    );

    console.log(
      "🎯 Afiliado detectado:",
      ref
    );

  }, []);

  return null;

}