"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import {
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";

export default function SalesChart() {

  const [data, setData] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {

    fetchChart();

  }, []);

 async function fetchChart() {

  try {

    setLoading(true);

    const today =
      new Date();

    const last30 =
      new Date();

    last30.setDate(
      today.getDate() - 29
    );

    const {
      data: sales,
      error,
    } = await supabase
      .from("affiliate_sales")
      .select("*")
      .gte(
        "created_at",
        last30.toISOString()
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    if (error) {

      console.error(
        "CHART ERROR:",
        error
      );

      return;

    }

    // MAPA COMPLETO 30 DIAS
    const daysMap: any = {};

    for (
      let i = 0;
      i < 30;
      i++
    ) {

      const current =
        new Date();

      current.setDate(
        today.getDate() - i
      );

      const key =
        current
          .toISOString()
          .split("T")[0];

      daysMap[key] = {

        day:
          current.toLocaleDateString(
            "pt-BR",
            {
              day: "2-digit",
              month: "2-digit",
            }
          ),

        sales: 0,

      };

    }

    // SOMA VENDAS
    sales?.forEach((sale) => {

      const saleDate =
        new Date(
          sale.created_at
        );

      const key =
        saleDate
          .toISOString()
          .split("T")[0];

      if (daysMap[key]) {

        daysMap[key].sales +=
          Number(
            sale.amount || 0
          );

      }

    });

    // ORDENA
    const finalData =
      Object.values(
        daysMap
      ).reverse();

    setData(finalData);

    console.log(
      "📈 FINAL CHART:",
      finalData
    );

  } catch (err) {

    console.error(err);

  } finally {

    setLoading(false);

  }

}

  return (

    <div
      className="
      bg-card
      border
      border-border
      rounded-[32px]
      p-8
      mt-8
      shadow-sm
    "
    >

      {/* HEADER */}
      <div
        className="
        flex
        flex-col
        lg:flex-row
        lg:items-center
        lg:justify-between
        gap-6
        mb-10
      "
      >

        <div>

          <h2
            className="
            text-3xl
            font-black
            tracking-tight
          "
          >
            Performance últimos 30 dias
          </h2>

          <p
            className="
            text-muted-foreground
            mt-2
            text-base
          "
          >
            Receita diária afiliados
          </p>

        </div>

      </div>

      {/* CHART */}
      <div className="h-[420px]">

        {loading ? (

          <div
            className="
            h-full
            flex
            items-center
            justify-center
            text-muted-foreground
          "
          >
            Carregando gráfico...
          </div>

        ) : (

          <ResponsiveContainer
            width="100%"
            height="100%"
          >

            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 10,
                left: -20,
                bottom: 0,
              }}
            >

              {/* GRADIENT */}
              <defs>

                <linearGradient
                  id="salesGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >

                  <stop
                    offset="0%"
                    stopColor="#facc15"
                    stopOpacity={0.35}
                  />

                  <stop
                    offset="100%"
                    stopColor="#facc15"
                    stopOpacity={0}
                  />

                </linearGradient>

              </defs>

              {/* GRID */}
              <CartesianGrid
                strokeDasharray="4 4"
                stroke="hsl(var(--border))"
                opacity={0.3}
                vertical={false}
              />

              {/* X */}
              <XAxis
                dataKey="day"
                tick={{
                  fill:
                    "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
              />

              {/* Y */}
              <YAxis
                tick={{
                  fill:
                    "hsl(var(--muted-foreground))",
                  fontSize: 12,
                }}
                axisLine={false}
                tickLine={false}
              />

              {/* TOOLTIP */}
              <Tooltip
                formatter={(value: any) => [
                  `R$ ${value}`,
                  "Vendas",
                ]}
                contentStyle={{
                  background:
                    "hsl(var(--card))",
                  border:
                    "1px solid hsl(var(--border))",
                  borderRadius:
                    "18px",
                }}
              />

              {/* AREA */}
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#facc15"
                strokeWidth={4}
                fill="url(#salesGradient)"
                dot={false}
                activeDot={{
                  r: 7,
                  fill: "#facc15",
                }}
              />

            </AreaChart>

          </ResponsiveContainer>

        )}

      </div>

    </div>

  );

}