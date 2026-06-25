"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter }
from "next/navigation";

import { supabase }
from "@/lib/supabase";

import DashboardLayout
from "@/components/dashboard-layout";

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

    const {
      data: listener,
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          session
        ) => {

          if (
            session?.user
          ) {

            setUser(
              session.user
            );

          } else {

            setUser(null);

            router.push("/");

          }

        }
      );

    return () => {

      listener.subscription.unsubscribe();

    };

  }, []);

  // =========================
  // LOAD USER
  // =========================

  async function loadUser() {

    try {

      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (
        !session?.user
      ) {

        router.push("/");

        return;

      }

      setUser(
        session.user
      );

    } catch (err) {

      console.error(
        "ERRO USER:",
        err
      );

      router.push("/");

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
        flex
        items-center
        justify-center
        text-white
        text-2xl
        "
      >

        Carregando dashboard...

      </div>

    );

  }

  // =========================
  // SEM USER
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