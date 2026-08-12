"use client";
import { useEffect } from "react";
import AuthProvider from "@/components/auth-provider";
export default function Home(){useEffect(()=>{const ref=new URLSearchParams(window.location.search).get("ref");if(ref)localStorage.setItem("affiliate_ref",ref)},[]);return <AuthProvider/>}
