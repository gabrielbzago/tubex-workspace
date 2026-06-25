"use client";

import { useState, useEffect } from "react";
import { supabase }
from "@/lib/supabase";

import {
  Home,
  Users,
  DollarSign,
  Settings,
  Bell,
  Search,
  Sparkles,
  CalendarDays,
  BarChart3,
  Image as ImageIcon,
} from "lucide-react";

import ThemeToggle from "./theme-toggle";
import SalesChart from "./sales-chart";
import UserMenu from "./user-menu";
import AffiliateGenerator from "./affiliate-generator";
import SeoAI from "./seo-ai";
import ThumbnailAI from "./thumbnail-ai";
import ViralContent from "./viral-content";
import AnalyticsAI from "./analytics-ai";
import AffiliatePage from "./affiliate-page";
import CreatorCalendar
from "@/components/creator-calendar";
import AdminAffiliates
from "@/components/admin-affiliates";

import { useUserData } from "@/hooks/use-user-data";

export default function DashboardLayout({
  user,
}: any) {

  const [activeTab, setActiveTab] =
    useState("dashboard");

const [
  youtubeChannels,
  setYoutubeChannels
] = useState<any[]>([]);

const [
  selectedChannel,
  setSelectedChannel
] = useState("");

const [
  showChannelSelector,
  setShowChannelSelector
] = useState(false);

  const {
    userData,
    loading,
    refreshUser,
  } = useUserData(user);

const [channelMetrics, setChannelMetrics] = useState({
  subscribers: 0,
  views30: 0,
  uploads30: 0,
  averageViews: 0,
});

const menu = [

  {
    id: "dashboard",
    icon: Home,
    label: "Dashboard",
  },

  {
    id: "seo",
    icon: Sparkles,
    label: "SEO Explorer",
  },

{
  id: "thumbnail-ai",
  icon: ImageIcon,
  label: "Thumbnail AI",
},

{
  id: "viral-content",
  icon: Sparkles,
  label: "Ideias Virais",
},

  {
    id: "analytics",
    icon: BarChart3,
    label: "Analytics",
  },

  {
    id: "calendar",
    icon: CalendarDays,
    label: "Calendário",
  },

  {
    id: "affiliate",
    icon: Users,
    label: "Afiliados",
  },

  {
    id: "commissions",
    icon: DollarSign,
    label: "Comissões",
  },

  ...(user?.email ===
    "gabrielbzago@gmail.com"
    ? [
        {
          id: "admin-affiliates",
          icon: DollarSign,
          label: "Admin Afiliados",
        },
      ]
    : []),

  {
    id: "settings",
    icon: Settings,
    label: "Configurações",
  },

];

async function connectYoutube() {
  console.log("CONNECT YOUTUBE CLICK");
  try {

    const {

      data:{session}

    }

    = await supabase
      .auth
      .getSession();

  console.log("SESSION:", session);
  console.log("TOKEN:", session?.provider_token);
    const accessToken =
      session?.provider_token;

    if (!accessToken) {

      alert(
        "Faça login novamente."
      );

      return;

    }

const response =
await fetch(
  "https://tubex-backend.vercel.app/api/youtube-my-channels",
  {
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      accessToken
    })
  }
);

console.log("STATUS:", response.status);

const json =
await response.json();

console.log("JSON:", json);

    if (!json.success) {

      alert(
        "Erro ao carregar canais."
      );

      return;

    }

    setYoutubeChannels(
      json.channels || []
    );

  }

  catch(err){

    console.error(err);

    alert(
      "Erro ao conectar YouTube."
    );

  }

}

async function loadChannelMetrics(channelId: string) {

  const response = await fetch(
    "https://tubex-backend.vercel.app/api/youtube-channel",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "tubex_secure_2026_ultra",
      },
      body: JSON.stringify({
        channelId,
      }),
    }
  );

  const json = await response.json();

  console.log("DASHBOARD METRICS", json);

  if (!json.success) return;
console.log(
  JSON.stringify(json.data.metrics, null, 2)
);

  setChannelMetrics({

  subscribers:
    json?.data?.metrics?.subscribers ?? 0,

  views30:
    json?.data?.metrics?.views30 ?? 0,

  uploads30:
    json?.data?.metrics?.uploads30 ?? 0,

  averageViews:
    json?.data?.metrics?.averageViews ??
    json?.data?.metrics?.avgViews ??
    json?.data?.metrics?.average_views ??
    0,

});

}

useEffect(() => {

  if (!userData?.youtube_channel_id) return;

  loadChannelMetrics(
    userData.youtube_channel_id
  );

}, [userData?.youtube_channel_id]);

async function saveYoutubeChannel() {

  const channel =
    youtubeChannels.find(

      c =>

      c.id === selectedChannel

    );

const response = await fetch(
  "https://tubex-backend.vercel.app/api/youtube-channel",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": "tubex_secure_2026_ultra"
    },
    body: JSON.stringify({
      channelId: channel.id
    })
  }
);



const stats = await response.json();

console.log("CHANNEL STATS", stats);

const subscribers =
  stats?.data?.metrics?.subscribers ||
  stats?.subscriberCount ||
  0;

const views30 =
  stats?.data?.metrics?.views30 ||
  stats?.views30Days ||
  0;

const uploads30 =
  stats?.data?.metrics?.uploads30 ||
  stats?.uploads30Days ||
  0;

const avgViews =
  stats?.data?.metrics?.averageViews ||
  stats?.averageViews ||
  0;

console.log("SUBSCRIBERS:", subscribers);
console.log("VIEWS30:", views30);
console.log("UPLOADS30:", uploads30);
console.log("AVG VIEWS:", avgViews);

console.log(
  "SUBS",
  stats?.data?.metrics?.subscribers
);

console.log(
  "VIEWS30",
  stats?.data?.metrics?.views30
);

console.log(
  "UPLOADS30",
  stats?.data?.metrics?.uploads30
);

console.log(
  "AVG",
  stats?.data?.metrics?.averageViews
);

  if (!channel) return;

await supabase
.from("users")
.update({

  youtube_channel_id:
    channel.id,

  youtube_channel_name:
    channel.snippet.title,

  youtube_connected:
    true,

  youtube_subscribers:
    subscribers,

  youtube_views30:
    views30,

  youtube_uploads30:
    uploads30,

  youtube_avg_views:
    avgViews

})
.eq("email", user.email);

await loadChannelMetrics(channel.id);

 await refreshUser();

setShowChannelSelector(false);

setYoutubeChannels([]);

setSelectedChannel("");

alert(
  "Canal conectado!"
);

}
  return (



    <div className="
      min-h-screen
      bg-background
      text-foreground
      flex
    ">

      {/* SIDEBAR */}
      <aside className="
        w-[300px]
        border-r
        border-border
        bg-card
        flex
        flex-col
        justify-between
        px-6
        py-8
      ">

        <div>

         {/* LOGO */}
<div
  className="
    flex
    items-center
    gap-4
    mb-14
  "
>

  <img
    src="/logo.png"
    alt="TubeX"
    className="
      h-14
      w-auto
      object-contain
    "
  />

  <div>

    <h1
      className="
        text-3xl
        font-black
      "
    >
    
    </h1>

    <p
      className="
        text-muted-foreground
        text-sm
      "
    >
      
    </p>

  </div>

</div>

          {/* MENU */}
          <nav className="space-y-2">

            {
              menu.map((item) => {

                const Icon = item.icon;

                return (

                  <button
                    key={item.id}
                    onClick={() =>
                      setActiveTab(item.id)
                    }
                    className={`
                      w-full
                      flex
                      items-center
                      gap-4
                      px-5
                      py-4
                      rounded-2xl
                      border
                      transition-all
                      duration-300

                      ${
                        activeTab === item.id

                        ? `
                          bg-primary
                          text-primary-foreground
                          border-primary
                          shadow-lg
                        `

                        : `
                          hover:bg-muted
                          border-transparent
                        `
                      }
                    `}
                  >

                    <Icon size={20} />

                    <span className="
                      font-medium
                    ">
                      {item.label}
                    </span>

                  </button>

                );

              })
            }

          </nav>

        </div>

        {/* USER CARD */}
        <div className="
          bg-background
          border
          border-border
          rounded-3xl
          p-5
        ">

          <div className="
            flex
            items-center
            gap-4
          ">

            <img
              src={
                user?.user_metadata?.avatar_url
              }
              className="
                w-14
                h-14
                rounded-2xl
                object-cover
              "
            />

            <div className="
              flex-1
              min-w-0
            ">

              <h3 className="
                font-bold
                truncate
              ">
                {
                  userData?.name
                  || user?.user_metadata?.full_name
                }
              </h3>

              <p className="
                text-sm
                text-muted-foreground
                truncate
              ">
                {user?.email}
              </p>

            </div>

          </div>

        </div>

      </aside>

      {/* MAIN */}
   <main className="
  flex-1
  min-w-0
  overflow-y-auto
  overflow-x-hidden
">

        {/* HEADER */}
        <header className="
          h-24
          border-b
          border-border
          px-10
          flex
          items-center
          justify-between
          sticky
          top-0
          bg-background/80
          backdrop-blur-xl
          z-50
        ">

          {/* LEFT */}
          <div>

            <h2 className="
              text-4xl
              font-black
            ">


{
  activeTab ===
  "admin-affiliates"
  && "Admin Afiliados"
}

              {
                activeTab === "dashboard"
                && "Dashboard"
              }

              {
                activeTab === "seo"
                && "SEO AI"
              }


{
  activeTab === "thumbnail-ai"
  && "Thumbnail AI"
}

{
  activeTab === "viral-content"
  && "Viral Content AI"
}

              {
  activeTab === "analytics"
  && "Analytics AI"
}

              {
                activeTab === "calendar"
                && "Calendário"
              }

              {
 		 activeTab === "affiliate"
		  && "Afiliados"
		}

              {
                activeTab === "commissions"
                && "Comissões"
              }

              {
                activeTab === "settings"
                && "Configurações"
              }

            </h2>
<div className="mt-1">

  <p className="text-muted-foreground">
    {
      loading
      ? "Carregando plano..."
      : `Plano atual: ${userData?.plan || "free"}`
    }
  </p>

  {
    userData?.youtube_connected && (
      <p className="text-green-500 text-sm font-semibold mt-2">
        Canal conectado: {userData?.youtube_channel_name}
      </p>
    )
  }

</div>
          </div>

          {/* RIGHT */}
          <div className="
            flex
            items-center
            gap-4
          ">

            {/* SEARCH */}
            <div className="
              hidden
              lg:flex
              items-center
              gap-3
              w-[340px]
              bg-card
              border
              border-border
              rounded-2xl
              px-4
              py-3
            ">

              <Search
                size={18}
                className="
                  text-muted-foreground
                "
              />

              <input
                placeholder="Buscar..."
                className="
                  bg-transparent
                  outline-none
                  text-sm
                  w-full
                "
              />

            </div>

            <ThemeToggle />

            <button className="
              w-12
              h-12
              rounded-2xl
              bg-card
              border
              border-border
              flex
              items-center
              justify-center
            ">

              <Bell size={18} />

            </button>

            <UserMenu />

          </div>

        </header>

        {/* CONTENT */}
        <div className="
  p-6
  lg:p-10
  w-full
  max-w-full
  overflow-hidden
">

{
  selectedChannel && (

    <button
      onClick={saveYoutubeChannel}
      className="
        px-4
        py-2
        rounded-xl
        bg-green-500
        text-white
      "
    >
      Salvar Canal
    </button>

  )
}

<div
  className="
    bg-card
    border
    border-border
    rounded-3xl
    p-6
    mb-6
  "
>

  <div
    className="
      flex
      items-center
      justify-between
      flex-wrap
      gap-4
    "
  >

    <div>

      <p
        className="
          text-sm
          text-muted-foreground
        "
      >
        Canal do YouTube
      </p>

      <div
        className="
          flex
          items-center
          gap-2
          mt-2
        "
      >

        {
          userData?.youtube_connected ? (
            <>
              <div
                className="
                  w-3
                  h-3
                  rounded-full
                  bg-green-500
                "
              />

              <span
                className="
                  text-xl
                  font-bold
                "
              >
                {userData.youtube_channel_name}
              </span>
            </>
          ) : (
            <span
              className="
                text-yellow-500
                font-semibold
              "
            >
              Nenhum canal conectado
            </span>
          )
        }

      </div>

    </div>

    <button

      onClick={async () => {

        await connectYoutube();

        setShowChannelSelector(true);

      }}

      className="
        px-5
        py-2
        rounded-xl
        bg-red-500
        text-white
        font-semibold
      "

    >

      {
        userData?.youtube_connected
          ? "Trocar Canal"
          : "Conectar Canal"
      }

    </button>

  </div>

</div>

{
  showChannelSelector &&
  youtubeChannels.length > 0 && (
    <div
      className="
        bg-card
        border
        border-border
        rounded-3xl
        p-6
        mb-6
      "
    >

      <h3
        className="
          text-lg
          font-bold
          mb-4
        "
      >
        Escolha um Canal
      </h3>

      <select

        value={selectedChannel}

        onChange={(e)=>
          setSelectedChannel(
            e.target.value
          )
        }

        className="
          w-full
          rounded-xl
          border
          border-border
          bg-background
          p-4
        "

      >

        <option value="">
          Selecione um canal
        </option>

        {

          youtubeChannels.map(
            (channel:any)=>(

              <option
                key={channel.id}
                value={channel.id}
              >

                {
                  channel.snippet.title
                }

              </option>

            )
          )

        }

      </select>

      {

        selectedChannel && (

          <button

            onClick={
              saveYoutubeChannel
            }

            className="
              mt-4
              px-6
              py-3
              rounded-xl
              bg-green-600
              text-white
              font-semibold
            "

          >

            Salvar Canal

          </button>

        )

      }

    </div>

  )
}

          {/* DASHBOARD */}
          {
            activeTab === "dashboard"
            && (

              <>

                {/* TOP STATS */}
                <div className="
                  grid
                  grid-cols-1
                  md:grid-cols-2
                  xl:grid-cols-4
                  gap-6
                ">

                  {


[
  {
    title:"Inscritos",
    value:channelMetrics.subscribers.toLocaleString()
  },

  {
    title:"Views 30 Dias",
    value:channelMetrics.views30.toLocaleString()
  },

  {
    title:"Uploads 30 Dias",
    value:channelMetrics.uploads30
  },

  {
    title:"Média por Vídeo",
    value:channelMetrics.averageViews.toLocaleString()
  }
]

                    .map((card, index) => (

                      <div
                        key={index}
                        className="
                          bg-card
                          border
                          border-border
                          rounded-3xl
                          p-7
                        "
                      >

                        <p className="
                          text-muted-foreground
                          text-sm
                          uppercase
                        ">
                          {card.title}
                        </p>

                        <h3 className="
                          text-5xl
                          font-black
                          mt-6
                        ">
                          {card.value}
                        </h3>

                      </div>

                    ))
                  }

                </div>

                {/* USER INFO */}
                <div className="
                  grid
                  grid-cols-1
                  md:grid-cols-3
                  gap-6
                  mt-6
                ">

                  {
                    [
                      {
                        title: "Plano",
                        value:
                        loading
                        ? "..."
                        : userData?.plan || "free",
                      },

                      {
                        title: "Status",
                        value:
                        loading
                        ? "..."
                        : userData?.status === "inactive"
 			 ? "Sem assinatura"
  			: userData?.status || "active"
                      },

                    {
  title: "Canal Conectado",
  value:
  loading
  ? "..."
  : userData?.youtube_channel_name || "---",
}

                    ].map((card, index) => (

                      <div
                        key={index}
                        className="
                          bg-card
                          border
                          border-border
                          rounded-3xl
                          p-7
                        "
                      >

                        <p className="
                          text-muted-foreground
                          text-sm
                          uppercase
                        ">
                          {card.title}
                        </p>

                        <h3 className="
                          text-3xl
                          font-black
                          mt-6
                          break-all
                        ">
                          {card.value}
                        </h3>

                      </div>

                    ))
                  }

<div
  className="
    bg-card
    border
    border-border
    rounded-3xl
    p-8
    mt-6
  "
>
  <h2
    className="
      text-2xl
      font-black
      mb-4
    "
  >
    Resumo da IA
  </h2>

  <p
    className="
      text-muted-foreground
      leading-relaxed
    "
  >
    Conecte um canal para receber
    diagnósticos automáticos,
    oportunidades de crescimento
    e sugestões estratégicas.
  </p>
</div>

                </div>

                {/* AFILIADO */}
                {
  user?.email ===
  "gabrielbzago@gmail.com" && (

    <AffiliateGenerator
      userData={userData}
      refreshUser={refreshUser}
    />

  )
}

                {/* CHART */}
                <div className="mt-8">

                  <SalesChart />

                </div>

              </>

            )
          }

          {/* SEO AI */}
          {
            activeTab === "seo"
            && (
             <SeoAI userData={userData} />
            )
          }
{
  activeTab === "thumbnail-ai"
  && (
    <ThumbnailAI
  userData={userData}
/>
  )
}

{
  activeTab === "viral-content"
  && (
    <ViralContent userData={userData} />
  )
}

          {/* ANALYTICS */}
        {
  activeTab === "analytics"
  && (
    <AnalyticsAI userData={userData} />
  )
}

            {/* CALENDAR */}
{
  activeTab === "calendar"
  && (
    <CreatorCalendar />
  )
}

{/* AFFILIATES */}
{
  activeTab === "affiliate"
  && (
    <AffiliatePage
      userData={userData}
    />
  )
}



          {/* COMMISSIONS */}
          {
            activeTab === "commissions"
            && (

              <div className="
                bg-card
                border
                border-border
                rounded-3xl
                p-10
              ">

                <h2 className="
                  text-3xl
                  font-black
                ">
                  Comissões
                </h2>

              </div>

            )
          }

{/* ADMIN AFFILIATES */}
{
  activeTab ===
    "admin-affiliates"
  && user?.email ===
    "gabrielbzago@gmail.com"
  && (
    <AdminAffiliates />
  )
}

          {/* SETTINGS */}
          {
            activeTab === "settings"
            && (

              <div className="
                bg-card
                border
                border-border
                rounded-3xl
                p-10
              ">

                <h2 className="
                  text-3xl
                  font-black
                ">
                  Configurações
                </h2>

              </div>

            )
          }

        </div>

      </main>

    </div>

  );

}

