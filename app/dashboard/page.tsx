"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import DashboardLayout
from "@/components/dashboard-layout";

import { supabase }
from "@/lib/supabase";

export default function DashboardPage() {

  const router =
    useRouter();

  const [user, setUser] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  // =========================
  // INIT
  // =========================

  useEffect(() => {

    loadUser();

  }, []);

  // =========================
  // USER
  // =========================

  async function loadUser() {

    try {

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      // SEM LOGIN
      if (
        !session?.user
      ) {

        router.push("/");

        return;

      }

      // USER
      setUser(
        session.user
      );

    } catch (err) {

      console.error(
        err
      );

    } finally {

      setLoading(false);

    }

  }

  // =========================
  // LOADING
  // =========================

  if (loading) {

    return (

      <div
        className="
        min-h-screen
        bg-black
        text-white
        flex
        items-center
        justify-center
        text-2xl
        "
      >

        Carregando dashboard...

      </div>

    );

  }

  // =========================
  // NO USER
  // =========================

  if (!user) {

    return null;

  }

  // =========================
  // DASHBOARD
  // =========================

  return (

    <DashboardLayout
      user={user}
    />

  );

}