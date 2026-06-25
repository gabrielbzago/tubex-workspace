"use client";

import {
useEffect,
useState,
} from "react";

import { supabase }
from "@/lib/supabase";

type UserData = {

  id?: string;

  email: string;

  name?: string;

  plan?: string;

  status?: string;

  affiliate_code?: string;

  affiliate_balance?: number;

  stripe_customer_id?: string;

  stripe_subscription_id?: string;

  youtube_connected?: boolean;

  youtube_channel_id?: string;

  youtube_channel_name?: string;

  youtube_subscribers?: number;

  youtube_views30?: number;

  youtube_uploads30?: number;

  youtube_avg_views?: number;

  total_sales?: number;

  total_clicks?: number;

  total_commission?: number;

  conversion_rate?: number;

  referrals?: any[];

  sales?: any[];

};

export function useUserData(
user: any
) {

const [loading, setLoading] =
useState(true);

const [userData, setUserData] =
useState<UserData | null>(null);

useEffect(() => {

if (!user?.email) {

  setLoading(false);

  return;

}

fetchUser();

}, [user]);

async function fetchUser() {

try {

  setLoading(true);

  // =========================
  // EMAIL
  // =========================

  const email =
    String(user.email)
      .trim()
      .toLowerCase();

  console.log(
    "📧 EMAIL:",
    email
  );

  // =========================
  // USER
  // =========================

  const {
    data: userRow,
    error: userError,
  } =
    await supabase
      .from("users")
      .select("*")
      .eq(
        "email",
        email
      )
      .maybeSingle();
console.log("USER ROW:", userRow);
console.log("USER ERROR:", userError);
if (!userRow) {

  const {
    data: newUser,
    error: insertError
  } = await supabase
    .from("users")
    .insert({
      email,
      name:
        user.user_metadata?.full_name ||
        email,
      plan: "free",
      status: "active"
    })
    .select()
    .single();

  console.log("NEW USER:", newUser);
console.log(
  "INSERT ERROR FULL:",
  JSON.stringify(insertError, null, 2)
);

  if (insertError) {
    console.error(insertError);
    return;
  }

  setUserData(newUser);
  return;
}  console.log(
    "✅ USER:",
    userRow
  );

  // =========================
  // AFFILIATE CODE
  // =========================

  const affiliateCode =
    userRow.affiliate_code;

  // =========================
  // REFERRALS
  // =========================

  const {
    data: referrals,
  } =
    await supabase
      .from(
        "affiliate_referrals"
      )
      .select("*")
      .eq(
        "affiliate_code",
        affiliateCode
      )
      .neq(
        "status",
        "canceled"
      );

  // =========================
  // SALES
  // =========================

  const {
    data: sales,
  } =
    await supabase
      .from(
        "affiliate_sales"
      )
      .select("*")
      .eq(
        "affiliate_code",
        affiliateCode
      )
      .eq(
        "status",
        "paid"
      );

  console.log(
    "💰 SALES:",
    sales
  );

  console.log(
    "👥 REFERRALS:",
    referrals
  );

  // =========================
  // TOTAL SALES
  // =========================

  const totalSales =
    sales?.length || 0;

  // =========================
  // TOTAL COMMISSION
  // =========================

  const totalCommission =
    sales?.reduce(
      (acc, sale) =>
        acc +
        Number(
          sale.commission_amount || 0
        ),
      0
    ) || 0;

  // =========================
  // TOTAL CLICKS
  // =========================

  const totalClicks =
    Number(
      userRow.total_clicks || 0
    );

  // =========================
  // CONVERSION
  // =========================

  const conversionRate =
    totalClicks > 0

      ? Number(
          (
            (
              totalSales /
              totalClicks
            ) * 100
          ).toFixed(2)
        )

      : 0;

  // =========================
  // FINAL USER
  // =========================

  const finalUser = {

    ...userRow,

    total_sales:
      totalSales,

    total_commission:
      totalCommission,

    total_clicks:
      totalClicks,

    conversion_rate:
      conversionRate,

    referrals:
      referrals || [],

    sales:
      sales || [],

  };

  console.log(
    "🚀 FINAL USER:",
    finalUser
  );

console.log(
  "YOUTUBE SUBS:",
  finalUser.youtube_subscribers
);

console.log(
  "YOUTUBE VIEWS30:",
  finalUser.youtube_views30
);

console.log(
  "YOUTUBE UPLOADS30:",
  finalUser.youtube_uploads30
);

console.log(
  "YOUTUBE AVG:",
  finalUser.youtube_avg_views
);

  setUserData(finalUser);

} catch (err) {

  console.error(
    "🔥 ERRO:",
    err
  );

  setUserData(null);

} finally {

  setLoading(false);

}


}

return {


userData,

loading,

refreshUser:
  fetchUser,


};

}
