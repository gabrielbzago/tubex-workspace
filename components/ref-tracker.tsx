"use client";

import { useEffect } from "react";

export default function RefTracker() {

  useEffect(() => {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const ref =
      params.get("ref");

    if (ref) {

      localStorage.setItem(
        "tubex_ref",
        ref
      );

      console.log(
        "🎯 Afiliado detectado:",
        ref
      );

    }

  }, []);

  return null;

}