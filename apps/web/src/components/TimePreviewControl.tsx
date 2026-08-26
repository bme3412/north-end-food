"use client";

import { useState } from "react";

import { LiveClock } from "@/components/LiveClock";
import { DAY_OPTIONS, formatAsOfLabel, nowAsOfTime, useAsOfTime } from "@/lib/asOfTime";

export function TimePreviewControl() {
  const { asOf, setAsOf, isLive } = useAsOfTime();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState("12:00");
  const [useRange, setUseRange] = useState(false);
  const [until, setUntil] = useState("14:00");

  function openPicker() {
    const seed = asOf ?? nowAsOfTime();
    setDay(seed.day);
    setTime(seed.time);
    setUseRange(Boolean(asOf?.until));
    setUntil(asOf?.until ?? "14:00");
    setOpen(true);
  }

  function apply() {
    setAsOf({ day, time, until: useRange ? until : null });
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm ${
          isLive ? "text-muted hover:bg-linen-2" : "bg-tomato-soft text-tomato"
        }`}
      >
        {isLive ? <LiveClock /> : <span className="tabular-nums">{formatAsOfLabel(asOf)}</span>}
        <span aria-hidden="true" className="text-[0.6rem]">
          ▾
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close time picker"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-line bg-card p-4 shadow-xl">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">See what&apos;s open</p>

            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-xs text-muted">Day</span>
              <select
                value={day}
                onChange={(event) => setDay(Number(event.target.value))}
                className="h-10 w-full rounded-xl border border-line bg-linen px-2"
              >
                {DAY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 flex gap-2">
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-xs text-muted">{useRange ? "From" : "Time"}</span>
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="h-10 w-full rounded-xl border border-line bg-linen px-2"
                />
              </label>
              {useRange ? (
                <label className="flex-1 text-sm">
                  <span className="mb-1 block text-xs text-muted">Until</span>
                  <input
                    type="time"
                    value={until}
                    onChange={(event) => setUntil(event.target.value)}
                    className="h-10 w-full rounded-xl border border-line bg-linen px-2"
                  />
                </label>
              ) : null}
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useRange}
                onChange={(event) => setUseRange(event.target.checked)}
                className="size-4 rounded border-line"
              />
              Check a time range
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAsOf(null);
                  setOpen(false);
                }}
                disabled={isLive}
                className="flex-1 rounded-full border border-line px-3 py-2 text-sm font-medium disabled:opacity-40"
              >
                Live
              </button>
              <button
                type="button"
                onClick={apply}
                className="flex-1 rounded-full bg-tomato px-3 py-2 text-sm font-bold text-linen"
              >
                Preview
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
