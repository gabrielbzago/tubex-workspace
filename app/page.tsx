"use client";

import { useEffect } from "react";

import AuthProvider from "@/components/auth-provider";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Pricing from "@/components/pricing-page";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";
export default function Home() {

  useEffect(() => {

    const params =
      new URLSearchParams(
        window.location.search
      );

    const ref =
      params.get("ref");

    if (ref) {

      localStorage.setItem(
        "affiliate_ref",
        ref
      );

      console.log(
        "AFILIADO:",
        ref
      );

    }

  }, []);

  return <AuthProvider />;

}