"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

const ROAD_D = `M 120 660
  C 120 560, 480 570, 480 480
  C 480 390, 120 400, 120 310
  C 120 220, 480 230, 480 140`;

const KEY_POINTS = [0, 0.33, 0.66, 1];

const DOT_FRAMES = [0, 1, 2, 3, 2, 1];

export default function RoadLoading({
  outletName,
}: {
  outletName?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [dots, setDots] = useState(0);
  const [dotPos, setDotPos] = useState(0);
  const [verdictShown, setVerdictShown] = useState(false);
  const [checks, setChecks] = useState([false, false, false]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const path = root.querySelector<SVGPathElement>("#sPath");
      const markersGroup = root.querySelector<SVGGElement>("#markers");
      const signalBars = gsap.utils.toArray<SVGElement>(".signal-bar", root);
      const car = root.querySelector<SVGCircleElement>(".car");
      if (!path || !markersGroup || !car) return;

      const roadPath = path;
      const pathLength = roadPath.getTotalLength();
      const markers = KEY_POINTS.map((progress) => {
        const pt = path.getPointAtLength(pathLength * progress);
        const c = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle"
        );
        c.setAttribute("cx", String(pt.x));
        c.setAttribute("cy", String(pt.y));
        c.setAttribute("r", "26");
        c.classList.add("marker");
        markersGroup.appendChild(c);
        return c;
      });

      gsap.set(path, {
        strokeDasharray: pathLength,
        strokeDashoffset: pathLength,
        opacity: 1,
      });

      gsap.set(".road-dash", {
        strokeDasharray: "14 12",
        opacity: 0,
      });

      gsap.set(car, { opacity: 0 });
      gsap.set(".marker", { opacity: 0, scale: 1 });
      gsap.set(".signal-bar", { opacity: 0 });

      let sReady = false;
      const transformOrigin = "center center";

      function checkMarkers(currentProgress: number) {
        if (!sReady) return;
        KEY_POINTS.forEach((kp, i) => {
          const marker = markers[i];
          if (currentProgress >= kp && !marker.dataset.passed) {
            marker.dataset.passed = "1";
            gsap.fromTo(
              marker,
              { opacity: 0, scale: 0.3, transformOrigin },
              {
                opacity: 1,
                scale: 1,
                duration: 0.4,
                ease: "back.out(3)",
              }
            );
          }
        });
      }

      function removeMarkers(currentProgress: number) {
        KEY_POINTS.forEach((kp, i) => {
          const marker = markers[i];
          if (currentProgress <= kp && !marker.dataset.removed) {
            marker.dataset.removed = "1";
            gsap.to(marker, {
              opacity: 0,
              scale: 0.3,
              duration: 0.35,
              ease: "back.in(3)",
              transformOrigin,
            });
          }
        });
      }

      function resetMarkers() {
        markers.forEach((m) => {
          delete m.dataset.passed;
          delete m.dataset.removed;
        });
        gsap.set(".marker", { opacity: 0, scale: 1 });
      }

      function moveCarUp(duration: number) {
        return {
          duration,
          ease: "none",
          onUpdate(this: gsap.core.Tween) {
            const currentProgress = this.progress();
            const point = roadPath.getPointAtLength(
              pathLength * currentProgress
            );
            gsap.set(car, { x: point.x, y: point.y, transformOrigin });
            checkMarkers(currentProgress);
          },
        };
      }

      function moveCarDown(duration: number) {
        return {
          duration,
          ease: "none",
          onUpdate(this: gsap.core.Tween) {
            const currentProgress = 1 - this.progress();
            const point = roadPath.getPointAtLength(
              pathLength * currentProgress
            );
            gsap.set(car, { x: point.x, y: point.y, transformOrigin });
            removeMarkers(currentProgress);
          },
        };
      }

      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.3 });

      tl.call(() => {
        sReady = false;
        resetMarkers();
        gsap.set(path, { strokeDashoffset: pathLength, opacity: 1 });
        gsap.set(".road-dash", { opacity: 0 });
        gsap.set(car, { opacity: 0 });
        gsap.set(".signal-bar", {
          opacity: 0,
          scale: 1,
          transformOrigin: "center bottom",
        });
      })
        .to(
          path,
          {
            strokeDashoffset: 0,
            duration: 1.2,
            ease: "power2.inOut",
            onComplete: () => {
              sReady = true;
            },
          },
          0
        )
        .to(".road-dash", { opacity: 1, duration: 0.2 }, "-=0.2")
        .set(car, { opacity: 1 })
        .to({}, moveCarUp(1.8))
        .fromTo(
          signalBars[0],
          { opacity: 0, scale: 0.3, transformOrigin: "center bottom" },
          { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(3)" }
        )
        .fromTo(
          signalBars[1],
          { opacity: 0, scale: 0.3, transformOrigin: "center bottom" },
          { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(3)" }
        )
        .fromTo(
          signalBars[2],
          { opacity: 0, scale: 0.3, transformOrigin: "center bottom" },
          { opacity: 1, scale: 1, duration: 0.25, ease: "back.out(3)" }
        )
        .to({}, { duration: 0.3 })
        .to(signalBars[2], { opacity: 0, duration: 0.2 })
        .to(signalBars[1], { opacity: 0, duration: 0.2 })
        .to(signalBars[0], { opacity: 0, duration: 0.2 })
        .to({}, moveCarDown(1.8))
        .to(car, { opacity: 0, duration: 0.15 })
        .to(".road-dash", { opacity: 0, duration: 0.2 })
        .to(path, {
          strokeDashoffset: pathLength,
          duration: 1.2,
          ease: "power2.inOut",
        })
        .call(() => {
          sReady = false;
        });
    }, root);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setVerdictShown(false);
    setDots(0);
    setDotPos(0);
    setChecks([false, false, false]);

    const title = root.querySelector<HTMLElement>(".rl-panel-title");
    const checkEls = gsap.utils.toArray<HTMLElement>(".rl-check", root);
    const verdict = root.querySelector<HTMLElement>(".rl-verdict");
    if (!title || checkEls.length === 0 || !verdict) return;

    function check(index: number) {
      setChecks((prev) => prev.map((on, i) => (i === index ? true : on)));
    }

    const ctx = gsap.context(() => {
      gsap.set([title, ...checkEls, verdict], { opacity: 0, y: 8 });
      const tl = gsap.timeline({ delay: 0.15 });
      tl.to(title, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" })
        .to(
          checkEls[0],
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
          0.15
        )
        .to(
          checkEls[1],
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
          "+=0.45"
        )
        .add(() => check(0))
        .to(
          checkEls[2],
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
          "+=0.45"
        )
        .add(() => check(1))
        .to(
          verdict,
          { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
          "+=0.2"
        )
        .add(() => {
          check(2);
          setVerdictShown(true);
        });
    }, root);

    return () => ctx.revert();
  }, [outletName]);

  useEffect(() => {
    if (!verdictShown) return;
    const id = window.setInterval(
      () =>
        setDotPos((p) => {
          const next = (p + 1) % DOT_FRAMES.length;
          setDots(DOT_FRAMES[next]);
          return next;
        }),
      350
    );
    return () => window.clearInterval(id);
  }, [verdictShown]);

  return (
    <div
      ref={rootRef}
      className={`rl-scene fixed inset-0 z-50 flex items-center justify-center${
        outletName ? " rl-compact" : ""
      }`}
    >
      <style>{`
        .rl-scene {
          position: fixed;
          inset: 0;
          z-index: 50;
          height: 100%;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: rgba(255, 255, 255, 0.6);
          -webkit-backdrop-filter: blur(4px);
          backdrop-filter: blur(4px);
        }
        .rl-scene svg {
          width: 90vw;
          max-width: 700px;
          height: auto;
          display: block;
        }
        .rl-scene .road {
          fill: none;
          stroke: #0055ff;
          stroke: lab(38.4009% 52.6132 -92.3857);
          stroke-width: 14;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 4px rgba(0, 85, 255, 0.4));
        }
        .rl-scene .road-dash {
          fill: none;
          stroke: #0055ff;
          stroke: lab(38.4009% 52.6132 -92.3857);
          stroke-width: 4;
          stroke-linecap: round;
          stroke-dasharray: 14 12;
          filter: drop-shadow(0 0 2px rgba(0, 85, 255, 0.4));
        }
        .rl-scene .car {
          fill: #0055ff;
          fill: lab(38.4009% 52.6132 -92.3857);
          filter: drop-shadow(0 0 4px rgba(0, 85, 255, 0.5));
        }
        .rl-scene .marker {
          fill: #0055ff;
          fill: lab(38.4009% 52.6132 -92.3857);
          stroke: none;
          opacity: 0;
          filter: drop-shadow(0 0 3px rgba(0, 85, 255, 0.4));
        }
        .rl-scene .signal-bar {
          fill: none;
          stroke: #0055ff;
          stroke: lab(38.4009% 52.6132 -92.3857);
          stroke-width: 7;
          stroke-linecap: round;
          opacity: 0;
          filter: drop-shadow(0 0 3px rgba(0, 85, 255, 0.4));
        }
        .rl-scene.rl-compact {
          flex-direction: column;
          gap: 6px;
          padding: 24px;
        }
        .rl-scene.rl-compact svg {
          width: 56vw;
          max-width: 300px;
        }
        .rl-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .rl-panel-title {
          font-size: 15px;
          font-weight: 600;
          color: #111827;
          line-height: 1.4;
        }
        .rl-panel-name {
          color: #0055ff;
          color: lab(38.4009% 52.6132 -92.3857);
        }
        .rl-checks {
          list-style: none;
          margin: 10px 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 240px;
        }
        .rl-check {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          width: 100%;
          font-size: 13.5px;
          color: #374151;
        }
        .rl-check-icon {
          color: #16a34a;
          font-weight: 700;
          font-size: 14px;
          line-height: 1;
          width: 13px;
          flex: none;
        }
        .rl-check-ring {
          width: 13px;
          height: 13px;
          flex: none;
          border: 2px solid rgba(0, 85, 255, 0.18);
          border-top-color: #0055ff;
          border-top-color: lab(38.4009% 52.6132 -92.3857);
          border-radius: 9999px;
          animation: rl-spin 0.8s linear infinite;
        }
        .rl-verdict {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          margin-top: 12px;
          font-size: 13.5px;
          color: #374151;
          width: 240px;
        }
        .rl-verdict-ring {
          width: 13px;
          height: 13px;
          flex: none;
          border: 2px solid rgba(0, 85, 255, 0.18);
          border-top-color: #0055ff;
          border-top-color: lab(38.4009% 52.6132 -92.3857);
          border-radius: 9999px;
          animation: rl-spin 0.8s linear infinite;
        }
        .rl-dots {
          display: inline-block;
          min-width: 30px;
          text-align: left;
          font-weight: 600;
          color: #111827;
          letter-spacing: 0.02em;
        }
        @keyframes rl-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      <svg
        viewBox={outletName ? "0 0 600 410" : "0 0 600 700"}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(0, 0)">
          <g
            transform={
              outletName
                ? "translate(300, 195) scale(0.62) translate(-300, -350)"
                : "translate(300, 350) scale(0.6) translate(-300, -350)"
            }
          >
            <path id="sPath" className="road" d={ROAD_D} />

            <path className="road-dash" d={ROAD_D} />

            <g id="signalBars">
              <path className="signal-bar" d="M 458 100 Q 480 86 502 100" />
              <path className="signal-bar" d="M 448 80  Q 480 62 512 80" />
              <path className="signal-bar" d="M 438 60  Q 480 38 522 60" />
            </g>

            <g id="markers"></g>

            <circle className="car" cx="0" cy="0" r="16" />
          </g>
        </g>
      </svg>

      {outletName ? (
        <div className="rl-panel">
          <div className="rl-panel-title">
            Investigating <span className="rl-panel-name">{outletName}</span>
          </div>
          <ul className="rl-checks">
            <li className="rl-check">
              {checks[0] ? (
                <span className="rl-check-icon">✓</span>
              ) : (
                <span className="rl-check-ring" />
              )}
              <span>Revenue anomaly</span>
            </li>
            <li className="rl-check">
              {checks[1] ? (
                <span className="rl-check-icon">✓</span>
              ) : (
                <span className="rl-check-ring" />
              )}
              <span>Inventory evidence</span>
            </li>
            <li className="rl-check">
              {checks[2] ? (
                <span className="rl-check-icon">✓</span>
              ) : (
                <span className="rl-check-ring" />
              )}
              <span>Product signals</span>
            </li>
          </ul>
          <div className="rl-verdict">
            <span className="rl-verdict-ring" />
            <span className="rl-verdict-text">Generating verdict</span>
            <span className="rl-dots">{".".repeat(dots)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}