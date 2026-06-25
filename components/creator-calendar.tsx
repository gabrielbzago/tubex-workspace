"use client";

import { useEffect, useState } from "react";

import FullCalendar from "@fullcalendar/react";

import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";

import {
  CalendarDays,
  Plus
} from "lucide-react";

import { supabase } from "@/lib/supabase";

export default function CreatorCalendar() {

  const [events, setEvents] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string | null>(null);

  // ======================================================
  // CARREGA USUÁRIO + EVENTOS
  // ======================================================

  useEffect(() => {

    loadCalendar();

  }, []);

  async function loadCalendar() {

    try {

      setLoading(true);

      // usuário autenticado
      const {

        data: { user }

      } = await supabase.auth.getUser();

      if (!user) {

        setLoading(false);

        return;

      }

      setUserId(user.id);

      const {

        data,

        error

      } = await supabase

        .from("creator_calendar")

        .select("*")

        .eq("user_id", user.id)

        .order("start_date", {

          ascending: true

        });

      if (error) throw error;

      const calendarEvents = (data || []).map(event => ({

        id: event.id,

        title: event.title,

        start: event.start_date,

        end: event.end_date,

        allDay: event.all_day,

        color: event.color

      }));

      setEvents(calendarEvents);

    }

  catch (err: any) {

  console.error("ERRO COMPLETO:", err);

  alert(JSON.stringify(err, null, 2));

}

    finally {

      setLoading(false);

    }

  }
  // ======================================================
  // CRIAR EVENTO
  // ======================================================

  async function handleDateClick(arg: any) {

    if (!userId) return;

    const title = prompt("Nome da tarefa");

    if (!title) return;

    try {

      const newEvent = {

        user_id: userId,

        title: title.trim(),

        description: "",

        start_date: arg.dateStr,

        end_date: arg.dateStr,

        all_day: true,

        color: "#facc15",

        status: "pending"

      };

      const {

        data,

        error

      } = await supabase

        .from("creator_calendar")

        .insert(newEvent)

        .select()

        .single();

      if (error) throw error;

      setEvents(prev => [

        ...prev,

        {

          id: data.id,

          title: data.title,

          start: data.start_date,

          end: data.end_date,

          allDay: data.all_day,

          color: data.color

        }

      ]);

    }

    catch (err) {

      console.error(err);

      alert("Erro ao criar evento.");

    }

  }

  // ======================================================
  // MOVER EVENTO
  // ======================================================

  async function handleEventDrop(info: any) {

    try {

      const {

        error

      } = await supabase

        .from("creator_calendar")

        .update({

          start_date: info.event.start,

          end_date: info.event.end

        })

        .eq("id", info.event.id);

      if (error) throw error;

    }

    catch (err) {

      console.error(err);

      info.revert();

    }

  }

  // ======================================================
  // REDIMENSIONAR EVENTO
  // ======================================================

  async function handleEventResize(info: any) {

    try {

      const {

        error

      } = await supabase

        .from("creator_calendar")

        .update({

          start_date: info.event.start,

          end_date: info.event.end

        })

        .eq("id", info.event.id);

      if (error) throw error;

    }

    catch (err) {

      console.error(err);

      info.revert();

    }

  }

  // ======================================================
  // EXCLUIR EVENTO
  // ======================================================

  async function handleEventClick(info: any) {

    const confirmDelete = confirm(

      `Excluir "${info.event.title}"?`

    );

    if (!confirmDelete) return;

    try {

      const {

        error

      } = await supabase

        .from("creator_calendar")

        .delete()

        .eq("id", info.event.id);

      if (error) throw error;

      setEvents(prev =>

        prev.filter(

          e => e.id !== info.event.id

        )

      );

    }

    catch (err) {

      console.error(err);

      alert("Erro ao excluir.");

    }

  }
return (

  <div
    className="
      w-full
      rounded-[32px]
      border
      border-zinc-800
      bg-zinc-900
      overflow-hidden
    "
  >

    {/* HEADER */}

    <div
      className="
        flex
        items-center
        justify-between
        p-8
        border-b
        border-zinc-800
      "
    >

      <div
        className="
          flex
          items-center
          gap-4
        "
      >

        <div
          className="
            w-14
            h-14
            rounded-2xl
            bg-yellow-400
            text-black
            flex
            items-center
            justify-center
          "
        >

          <CalendarDays />

        </div>

        <div>

          <h2
            className="
              text-3xl
              font-black
              text-white
            "
          >
            Creator Calendar
          </h2>

          <p
            className="
              text-zinc-400
              mt-1
            "
          >
            Planeje vídeos, Shorts, ideias e metas.
          </p>

        </div>

      </div>

      <button
        className="
          h-14
          px-6
          rounded-2xl
          bg-yellow-400
          text-black
          font-bold
          flex
          items-center
          gap-2
          opacity-70
          cursor-default
        "
      >

        <Plus size={20} />

        Clique em um dia

      </button>

    </div>

    {/* LOADING */}

    {

      loading && (

        <div
          className="
            p-16
            text-center
            text-zinc-400
          "
        >

          Carregando calendário...

        </div>

      )

    }

    {

      !loading && (

        <div className="p-6">

          <FullCalendar

            plugins={[

              dayGridPlugin,

              timeGridPlugin,

              interactionPlugin,

              listPlugin

            ]}

            initialView="dayGridMonth"

            height="auto"

            editable={true}

            selectable={true}

            droppable={true}

            weekends={true}

            events={events}

            dateClick={handleDateClick}

            eventDrop={handleEventDrop}

            eventResize={handleEventResize}

            eventClick={handleEventClick}

            headerToolbar={{

              left: "prev,next today",

              center: "title",

              right:
                "dayGridMonth,timeGridWeek,timeGridDay,listWeek"

            }}

            buttonText={{

              today: "Hoje",

              month: "Mês",

              week: "Semana",

              day: "Dia",

              list: "Lista"

            }}

            locale="pt-br"

            eventTimeFormat={{

              hour: "2-digit",

              minute: "2-digit",

              meridiem: false

            }}

            dayMaxEvents={true}

            nowIndicator={true}

          />

        </div>

      )

    }

  </div>

);

}

