import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i,"").trim();
  if (!token) return NextResponse.json({error:"unauthorized"},{status:401});
  const {data,error} = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) return NextResponse.json({error:"unauthorized"},{status:401});
  const ownerEmail = String(process.env.OWNER_EMAIL || process.env.NEXT_PUBLIC_OWNER_EMAIL || "gabrielbzago@gmail.com").toLowerCase();
  if (data.user.email.toLowerCase() !== ownerEmail) return NextResponse.json({error:"forbidden"},{status:403});

  const url = new URL(request.url);
  const days = Math.max(1,Math.min(90,Number(url.searchParams.get("days") || 30)));
  const since = new Date(Date.now()-days*86400000).toISOString();
  const {data:events,error:queryError} = await supabaseAdmin.from("tubex_events")
    .select("user_id,install_id,event_name,module,created_at,properties")
    .gte("created_at",since).order("created_at",{ascending:false}).limit(20000);
  if (queryError) return NextResponse.json({error:"analytics_query_failed"},{status:503});

  const list = events || [];
  const count = (name:string) => list.filter(e=>e.event_name===name).length;
  const unique = (key:"user_id"|"install_id", filter?:(e:any)=>boolean) =>
    new Set(list.filter(e=>(!filter||filter(e))&&e[key]).map(e=>e[key])).size;
  const byModule:Record<string,number> = {};
  const byEvent:Record<string,number> = {};
  const daily:Record<string,{installs:number;searches:number;logins:number}> = {};
  for (const e of list) {
    const day=String(e.created_at).slice(0,10);
    daily[day] ||= {installs:0,searches:0,logins:0};
    if(e.event_name==="extension_installed") daily[day].installs++;
    if(e.event_name==="search_performed"||e.event_name==="analysis_completed") daily[day].searches++;
    if(e.event_name==="login_success") daily[day].logins++;
    byEvent[e.event_name]=(byEvent[e.event_name]||0)+1;
    if(e.module) byModule[e.module]=(byModule[e.module]||0)+1;
  }
  // Completa o período com dias sem eventos para o histórico não ficar irregular.
  for (let offset=days-1; offset>=0; offset--) {
    const date=new Date();
    date.setUTCHours(0,0,0,0);
    date.setUTCDate(date.getUTCDate()-offset);
    const key=date.toISOString().slice(0,10);
    daily[key] ||= {installs:0,searches:0,logins:0};
  }
  const moduleOpens=list.filter(e=>e.event_name==="module_opened");
  const usersInstalled=unique("install_id",e=>e.event_name==="extension_installed");
  const usersLogged=unique("user_id",e=>e.event_name==="login_success");
  const usersSearched=unique("user_id",e=>e.event_name==="search_performed"||e.event_name==="analysis_completed");
  return NextResponse.json({
    days, totals:{
      installs:usersInstalled, logins:count("login_success"), activeUsers:unique("user_id"),
      searches:count("search_performed")+count("analysis_completed"),
      pricingViews:count("pricing_viewed"), upgrades:count("upgrade_clicked"),
      checkouts:count("checkout_started"), subscriptions:count("subscription_activated"),
      quotaHits:count("quota_exhausted"), errors:count("api_error"),
      loggedUsers:usersLogged, searchedUsers:usersSearched
    },
    funnel:[
      {name:"Instalações",value:usersInstalled},
      {name:"Logins",value:usersLogged},
      {name:"Usuários que pesquisaram",value:usersSearched},
      {name:"Visualizaram planos",value:unique("user_id",e=>e.event_name==="pricing_viewed")},
      {name:"Iniciaram checkout",value:unique("user_id",e=>e.event_name==="checkout_started")},
      {name:"Assinaram",value:unique("user_id",e=>e.event_name==="subscription_activated")}
    ],
    modules:Object.entries(byModule).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),
    events:Object.entries(byEvent).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value),
    daily:Object.entries(daily).sort(([a],[b])=>a.localeCompare(b)).map(([date,v])=>({date,...v})),
    recent:list.slice(0,100).map(e=>({user_id:e.user_id,install_id:e.install_id,event_name:e.event_name,module:e.module,created_at:e.created_at}))
  },{headers:{"Cache-Control":"no-store"}});
}
