import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Maximize, Minimize } from "lucide-react";
import { useQueueDisplay } from "../services/queueHub.js";

export default function QueueDisplay() {
  const [searchParams] = useSearchParams();

  const departmentParam = searchParams.get("department") || "all";

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAlertFlashing, setIsAlertFlashing] = useState(false);

  const {
    currentCall,
    recentCalls,
    connectionState,
    lastAlertEvent,
  } = useQueueDisplay({ department: departmentParam });

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser fullscreen rejection fallback
    }
  }, []);

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Subtle border highlight on new call / recall
  useEffect(() => {
    if (!lastAlertEvent) return;
    const activateTimer = setTimeout(() => setIsAlertFlashing(true), 0);
    const flashTimer = setTimeout(() => setIsAlertFlashing(false), 2400);
    return () => {
      clearTimeout(activateTimer);
      clearTimeout(flashTimer);
    };
  }, [lastAlertEvent]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleFullscreen]);

  const timeFormatted = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const dateFormatted = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className="relative h-screen w-screen overflow-hidden no-scrollbar select-none font-sans flex flex-col bg-[#132c28] text-[#f2f4ef]"
    >
      {/* 1. Facility Header Bar */}
      <header className="px-5 lg:px-8 py-3.5 lg:py-5 border-b border-[#2d4b43] bg-[#17332f] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg border border-[#38534b] bg-[#1e443e] flex items-center justify-center font-serif text-2xl text-[#f2c66d] leading-none">
            q
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-[#f2f4ef]">
              Clinic Queue Demo
            </h1>
            <p className="text-xs text-[#bad0c7] tracking-wider uppercase font-medium mt-0.5">
              Public Queue Display
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          {/* Keep the fullscreen control available to mouse, touch, and keyboard users. */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                toggleFullscreen();
              }}
              title={isFullscreen ? "Exit fullscreen (F)" : "Enter fullscreen (F)"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              className="p-2 rounded-md border border-[#38534b] bg-[#1e443e] text-[#bad0c7] hover:text-white hover:border-[#42645e] transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>

          {/* Connection Status Indicator */}
          <div className="flex items-center gap-2 pl-4 border-l border-[#2d4b43] text-xs text-[#bad0c7]">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === "connected"
                  ? "bg-[#568367]"
                  : connectionState === "reconnecting"
                  ? "bg-[#f2c66d] animate-pulse"
                  : "bg-[#bd5555]"
              }`}
            />
            <span className="capitalize">{connectionState === "connected" ? "Live" : connectionState}</span>
          </div>

          {/* Digital Clock in the Corner */}
          <div className="text-right pl-4 border-l border-[#2d4b43]">
            <div className="text-2xl font-serif text-[#f2c66d] tracking-wide leading-none">
              {timeFormatted}
            </div>
            <div className="text-xs text-[#a9bfb4] mt-1 font-medium">
              {dateFormatted}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Screen Area: Left Hero Now Serving & Right Multi-Counter Grid */}
      <main className="flex-1 p-4 lg:p-6 xl:p-8 grid grid-cols-12 gap-4 lg:gap-6 xl:gap-8 overflow-y-auto lg:overflow-hidden min-h-0 no-scrollbar">
        {/* Left Column: Now Serving */}
        <section className="col-span-12 lg:col-span-7 flex flex-col min-h-0">
          <div
            className={`flex-1 rounded-xl p-6 lg:p-8 xl:p-10 flex flex-col justify-between border transition-colors duration-500 overflow-hidden ${
              isAlertFlashing
                ? "border-[#f2c66d] bg-[#224b43]"
                : "border-[#2d4b43] bg-[#1a3832]"
            }`}
          >
            {/* Top Eyebrow & Service Badge */}
            <div className="flex items-center justify-between shrink-0">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-[#38534b] bg-[#16332d] text-sm font-bold tracking-wider text-[#f2c66d] uppercase">
                <span className="w-2 h-2 rounded-full bg-[#f2c66d] animate-pulse" />
                {currentCall?.status === "Recalled" ? "TICKET RECALLED" : "NOW SERVING"}
              </span>

              {currentCall?.department && (
                <span className="px-3.5 py-1.5 rounded-md border border-[#38534b] bg-[#234b43] text-sm font-semibold text-[#bad0c7] tracking-wider uppercase">
                  {currentCall.department}
                </span>
              )}
            </div>

            {/* Prominent Ticket Number in Georgia Serif */}
          <div className="my-auto text-center py-4 lg:py-6">
              <p className="text-xs font-bold tracking-[0.2em] text-[#8ea69c] uppercase mb-2">
                {currentCall ? "TICKET NUMBER" : "READY FOR THE FIRST CALL"}
              </p>
            {currentCall ? (
              <div className="font-serif text-8xl lg:text-9xl text-[#f2c66d] tracking-tight leading-none">
                {currentCall.ticketNumber}
              </div>
            ) : (
              <p className="text-2xl lg:text-4xl font-medium text-[#f2f4ef]">No tickets have been called.</p>
            )}
            </div>

            {/* Counter Destination Footprint */}
            <div className="rounded-lg p-4 lg:p-5 border border-[#2d4b43] bg-[#16332d] flex flex-wrap items-center justify-between gap-4 shrink-0">
              <div>
                <span className="text-[11px] font-bold tracking-[0.15em] text-[#8ea69c] uppercase block mb-1">
                  PLEASE PROCEED TO
                </span>
                <span className="text-2xl lg:text-3xl font-semibold tracking-tight text-[#f2f4ef]">
                  {currentCall?.counterName || "Awaiting call"}
                </span>
              </div>

              {/* Status placed beside called/serving with matching font size */}
              <div className="flex items-center gap-2.5">
                <span className="text-sm lg:text-base font-semibold text-[#bad0c7]">
                  Status:
                </span>
                <span className="px-3.5 py-1 rounded-md border border-[#38534b] bg-[#1a3832] text-sm lg:text-base font-bold text-[#f2c66d] tracking-wider uppercase">
                  {currentCall?.status || "Waiting"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Active Counters Grid */}
        <section className="col-span-12 lg:col-span-5 flex flex-col min-h-0">
          <div className="flex-1 rounded-xl p-5 lg:p-6 border border-[#2d4b43] bg-[#1a3832] flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#2d4b43] mb-3.5 shrink-0">
              <h2 className="text-sm font-bold tracking-[0.12em] text-[#bad0c7] uppercase">
                Recent Calls
              </h2>
              <span className="text-xs text-[#8ea69c]">
                {recentCalls.length} more called tickets
              </span>
            </div>

            {/* Responsive grid to fit all active counters on TV/screen without cut-off */}
            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5 content-start">
              {recentCalls.length === 0 ? (
                <div className="col-span-full py-12 text-center text-[#8ea69c] text-xs">
                  No other called tickets yet.
                </div>
              ) : (
                recentCalls.map((item, index) => (
                  <div
                    key={`${item.ticketNumber}-${index}`}
                    className="rounded-lg p-3 lg:p-3.5 border border-[#2d4b43] bg-[#16332d] flex items-center justify-between transition-colors hover:border-[#38534b]"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-[11px] font-bold tracking-wider text-[#8ea69c] uppercase block truncate">
                        {item.counterName}
                      </span>
                      <span className="text-xs lg:text-sm text-[#bad0c7] font-medium mt-0.5 block truncate">
                        {item.department || "Consultation"}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-serif text-xl lg:text-2xl font-normal text-[#f2c66d] tracking-normal leading-none">
                        {item.ticketNumber}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded border border-[#2d4b43] bg-[#1a3832] text-[10px] lg:text-[11px] font-semibold text-[#bad0c7] uppercase tracking-wider">
                        {item.status || "Serving"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 3. Generic presentation guidance; clinic-specific content must come from approved configuration. */}
      <footer className="h-11 border-t border-[#2d4b43] bg-[#102421] flex items-center overflow-hidden shrink-0 text-xs">
        <div className="px-5 h-full bg-[#183a34] text-[#f2c66d] font-bold text-[10px] uppercase tracking-[0.12em] flex items-center shrink-0 border-r border-[#2d4b43]">
          Advisories
        </div>

        <div className="relative flex-1 overflow-hidden h-full flex items-center">
          <div className="whitespace-nowrap flex items-center gap-12 animate-marquee text-[#bad0c7] font-medium">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f2c66d]" />
              Local presentation demo · no patient information is used.
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#568367]" />
              Please watch for your issued ticket number.
            </span>
            {/* Duplicate for seamless marquee continuity */}
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f2c66d]" />
              Local presentation demo · no patient information is used.
            </span>
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#568367]" />
              Please watch for your issued ticket number.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
