import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   SCORE Coaching Academy — Landing Page
   Вариант «Regina Butler»
   Палитра: #2B2C2E, #F4F0EF, #2F5468, #D7A697, #304F68
   Типографика: Playfair Display + DM Sans
   ═══════════════════════════════════════════════════════════════ */

const C = {
  ink: "#2B2C2E",
  inkSoft: "#5A5A5E",
  inkMuted: "#8E8E92",
  cream: "#F4F0EF",
  creamDark: "#EBE5E3",
  teal: "#2F5468",
  tealLight: "#3A6A82",
  tealPale: "#E8EFF3",
  rose: "#D7A697",
  roseHover: "#C4907F",
  roseLight: "#F0DDD9",
  rosePale: "#F5E6E1",
  navy: "#304F68",
  navyLight: "#D6E2EC",
  white: "#FFFFFF",
  border: "#E0DCDA",
  success: "#6B9E7D",
  overlay: "rgba(43,44,46,0.6)",
};

/* ─── Google Fonts ─── */
const fontHref =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap";
if (typeof document !== "undefined" && !document.querySelector(`link[href*="Playfair"]`)) {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = fontHref;
  document.head.appendChild(l);
}

const serif = "'Playfair Display', Georgia, 'Times New Roman', serif";
const sans = "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif";

/* ─── Icons (inline SVG) ─── */
const Icon = {
  Play: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  Check: ({ size = 18, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Star: ({ size = 16, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  ArrowRight: ({ size = 20, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  Users: ({ size = 24, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  BookOpen: ({ size = 24, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  ),
  Award: ({ size = 24, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
  Target: ({ size = 24, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Heart: ({ size = 24, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  ),
  Zap: ({ size = 24, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Menu: ({ size = 24, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  X: ({ size = 24, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Quote: ({ size = 32, color = "currentColor" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" opacity="0.15">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  ),
};

/* ─── Scroll animation hook ─── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ─── Animated section wrapper ─── */
function Reveal({ children, delay = 0, style = {} }) {
  const [ref, visible] = useInView(0.12);
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.8s cubic-bezier(.16,1,.3,1) ${delay}s, transform 0.8s cubic-bezier(.16,1,.3,1) ${delay}s`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTIONS
   ═══════════════════════════════════════════════════════════════ */

/* ─── NAV ─── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const navLinks = [
    { label: "Программы", href: "#programs" },
    { label: "Метод", href: "#method" },
    { label: "Отзывы", href: "#testimonials" },
    { label: "Тарифы", href: "#pricing" },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: scrolled ? "rgba(244,240,239,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(1.4)" : "none",
        borderBottom: scrolled ? `1px solid ${C.border}` : "1px solid transparent",
        transition: "all 0.4s ease",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 72 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.white, fontFamily: serif, fontSize: 16, fontWeight: 600,
          }}>S</div>
          <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: C.ink, letterSpacing: "-0.02em" }}>
            SCORE <span style={{ fontWeight: 400, color: C.inkSoft }}>Academy</span>
          </span>
        </div>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", gap: 36 }} className="nav-desktop">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{
                fontFamily: sans, fontSize: 14, fontWeight: 500, color: C.inkSoft,
                textDecoration: "none", letterSpacing: "0.01em",
                transition: "color 0.25s",
              }}
              onMouseEnter={(e) => (e.target.style.color = C.teal)}
              onMouseLeave={(e) => (e.target.style.color = C.inkSoft)}
            >
              {l.label}
            </a>
          ))}
          <a
            href="#pricing"
            style={{
              fontFamily: sans, fontSize: 14, fontWeight: 600,
              color: C.white, background: C.teal,
              padding: "10px 24px", borderRadius: 8,
              textDecoration: "none",
              transition: "background 0.25s, transform 0.2s",
            }}
            onMouseEnter={(e) => { e.target.style.background = C.tealLight; e.target.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.target.style.background = C.teal; e.target.style.transform = "translateY(0)"; }}
          >
            Начать обучение
          </a>
        </div>

        {/* Mobile burger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "none" }}
          className="nav-burger"
        >
          {menuOpen ? <Icon.X color={C.ink} /> : <Icon.Menu color={C.ink} />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {menuOpen && (
        <div style={{
          position: "fixed", top: 72, left: 0, right: 0, bottom: 0,
          background: C.cream, padding: "32px", display: "flex", flexDirection: "column", gap: 24,
        }}>
          {navLinks.map((l) => (
            <a
              key={l.href} href={l.href}
              onClick={() => setMenuOpen(false)}
              style={{ fontFamily: serif, fontSize: 24, color: C.ink, textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
          <a href="#pricing" onClick={() => setMenuOpen(false)} style={{
            fontFamily: sans, fontSize: 16, fontWeight: 600, color: C.white, background: C.teal,
            padding: "14px 32px", borderRadius: 10, textDecoration: "none", textAlign: "center", marginTop: 16,
          }}>
            Начать обучение
          </a>
        </div>
      )}
    </nav>
  );
}

/* ─── HERO ─── */
function Hero() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setTimeout(() => setLoaded(true), 100); }, []);

  return (
    <section style={{
      position: "relative", minHeight: "100vh",
      background: `linear-gradient(160deg, ${C.cream} 0%, ${C.rosePale} 40%, ${C.tealPale} 100%)`,
      overflow: "hidden",
      display: "flex", alignItems: "center",
    }}>
      {/* Decorative circles */}
      <div style={{
        position: "absolute", top: "-15%", right: "-8%",
        width: 600, height: 600, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.roseLight} 0%, transparent 70%)`,
        opacity: 0.6, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-10%", left: "-5%",
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, ${C.tealPale} 0%, transparent 70%)`,
        opacity: 0.8, pointerEvents: "none",
      }} />

      {/* Geometric accents */}
      <div style={{
        position: "absolute", top: "18%", right: "12%",
        width: 120, height: 120, border: `2px solid ${C.rose}`,
        borderRadius: "50%", opacity: 0.3, pointerEvents: "none",
        animation: "float 8s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "22%", right: "20%",
        width: 60, height: 60, border: `2px solid ${C.teal}`,
        transform: "rotate(45deg)", opacity: 0.2, pointerEvents: "none",
        animation: "float 6s ease-in-out infinite reverse",
      }} />

      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "140px 32px 100px",
        position: "relative", zIndex: 2,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center",
      }}>
        {/* Left — text */}
        <div>
          <div style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.8s cubic-bezier(.16,1,.3,1) 0.1s",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: C.white, padding: "6px 16px", borderRadius: 100,
              boxShadow: "0 2px 12px rgba(47,84,104,0.08)",
              marginBottom: 28,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.success, animation: "pulse 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: sans, fontSize: 13, fontWeight: 500, color: C.teal, letterSpacing: "0.02em" }}>
                Набор открыт — старт 1 апреля
              </span>
            </div>
          </div>

          <h1 style={{
            fontFamily: serif, fontSize: 56, fontWeight: 600,
            color: C.ink, lineHeight: 1.1, letterSpacing: "-0.025em",
            margin: 0, marginBottom: 24,
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(40px)",
            transition: "all 0.9s cubic-bezier(.16,1,.3,1) 0.2s",
          }}>
            Стань коучем,{" "}
            <span style={{
              color: C.teal,
              position: "relative",
              display: "inline-block",
            }}>
              который меняет
              <svg style={{ position: "absolute", bottom: -4, left: 0, width: "100%", height: 12 }} viewBox="0 0 200 12" preserveAspectRatio="none">
                <path d="M0 8 Q50 0 100 6 Q150 12 200 4" stroke={C.rose} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7" />
              </svg>
            </span>{" "}
            жизни
          </h1>

          <p style={{
            fontFamily: sans, fontSize: 18, lineHeight: 1.7,
            color: C.inkSoft, margin: 0, marginBottom: 36,
            maxWidth: 480,
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(40px)",
            transition: "all 0.9s cubic-bezier(.16,1,.3,1) 0.35s",
          }}>
            Авторская программа сертификации ICF на базе метода SCORE.
            Глубокая трансформация, живая практика, поддержка на каждом этапе.
          </p>

          <div style={{
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(40px)",
            transition: "all 0.9s cubic-bezier(.16,1,.3,1) 0.5s",
          }}>
            <a href="#pricing" style={{
              fontFamily: sans, fontSize: 16, fontWeight: 600,
              color: C.white, background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`,
              padding: "16px 36px", borderRadius: 12,
              textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10,
              boxShadow: `0 8px 32px rgba(47,84,104,0.25)`,
              transition: "transform 0.25s, box-shadow 0.25s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(47,84,104,0.35)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(47,84,104,0.25)"; }}
            >
              Выбрать программу
              <Icon.ArrowRight size={18} color={C.white} />
            </a>
            <button style={{
              fontFamily: sans, fontSize: 16, fontWeight: 500,
              color: C.teal, background: "transparent",
              padding: "16px 24px", borderRadius: 12,
              border: `2px solid ${C.border}`,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              transition: "all 0.25s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; e.currentTarget.style.background = C.tealPale; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = "transparent"; }}
            >
              <Icon.Play size={16} color={C.teal} />
              Смотреть видео
            </button>
          </div>

          {/* Social proof */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16, marginTop: 48,
            opacity: loaded ? 1 : 0,
            transition: "opacity 1s ease 0.7s",
          }}>
            <div style={{ display: "flex" }}>
              {[C.teal, C.rose, C.navy, "#8FA89B", "#B36A5E"].map((bg, i) => (
                <div key={i} style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${bg}, ${bg}dd)`,
                  border: `2px solid ${C.cream}`,
                  marginLeft: i ? -10 : 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.white,
                }}>
                  {["АК", "МД", "ЕС", "ОВ", "ИП"][i]}
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.ink }}>
                1 200+ выпускников
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                {[...Array(5)].map((_, i) => <Icon.Star key={i} size={13} color="#D4A844" />)}
                <span style={{ fontFamily: sans, fontSize: 12, color: C.inkMuted, marginLeft: 4 }}>4.9 / 5</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right — visual card */}
        <div style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? "translateY(0) rotate(0deg)" : "translateY(50px) rotate(2deg)",
          transition: "all 1s cubic-bezier(.16,1,.3,1) 0.4s",
        }}>
          <div style={{
            background: C.white,
            borderRadius: 24,
            padding: 0,
            boxShadow: "0 24px 80px rgba(47,84,104,0.12), 0 8px 24px rgba(47,84,104,0.06)",
            overflow: "hidden",
            position: "relative",
          }}>
            {/* Card header visual */}
            <div style={{
              background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`,
              padding: "40px 36px 52px",
              position: "relative",
              overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", top: -30, right: -30,
                width: 120, height: 120, borderRadius: "50%",
                background: "rgba(215,166,151,0.15)",
              }} />
              <div style={{
                position: "absolute", bottom: -20, left: "40%",
                width: 80, height: 80, borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
              }} />
              <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.65)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
                Флагманская программа
              </div>
              <div style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, color: C.white, lineHeight: 1.2, marginBottom: 8 }}>
                SCORE Method
              </div>
              <div style={{ fontFamily: sans, fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>
                Сертификация коуча уровня ACC / PCC
              </div>
            </div>

            {/* Card body */}
            <div style={{ padding: "28px 36px 36px" }}>
              {[
                { label: "Формат", value: "Онлайн + очные интенсивы" },
                { label: "Длительность", value: "9 месяцев, 240 часов" },
                { label: "Практика", value: "80+ часов с реальными клиентами" },
                { label: "Менторинг", value: "Персональный ментор ICF PCC" },
              ].map((item, i) => (
                <div key={i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 0",
                  borderBottom: i < 3 ? `1px solid ${C.border}` : "none",
                }}>
                  <span style={{ fontFamily: sans, fontSize: 14, color: C.inkMuted }}>{item.label}</span>
                  <span style={{ fontFamily: sans, fontSize: 14, fontWeight: 500, color: C.ink }}>{item.value}</span>
                </div>
              ))}

              <div style={{
                marginTop: 24, padding: "16px 20px",
                background: C.rosePale, borderRadius: 12,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: `linear-gradient(135deg, ${C.rose}, ${C.roseHover})`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon.Award size={20} color={C.white} />
                </div>
                <div>
                  <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.ink }}>Международная сертификация</div>
                  <div style={{ fontFamily: sans, fontSize: 12, color: C.inkSoft }}>ICF аккредитация ACSTH / ACTP</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── STATS BAND ─── */
function Stats() {
  const stats = [
    { number: "1 200+", label: "Выпускников" },
    { number: "94%", label: "Получили сертификацию" },
    { number: "240", label: "Часов обучения" },
    { number: "12", label: "Лет на рынке" },
  ];

  return (
    <section style={{ background: C.white, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "48px 32px",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32,
      }}>
        {stats.map((s, i) => (
          <Reveal key={i} delay={i * 0.1}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: serif, fontSize: 42, fontWeight: 600, color: C.teal, letterSpacing: "-0.03em" }}>
                {s.number}
              </div>
              <div style={{ fontFamily: sans, fontSize: 14, color: C.inkMuted, marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ─── METHOD (SCORE) ─── */
function Method() {
  const steps = [
    { letter: "S", title: "Symptoms", desc: "Определяем текущую ситуацию клиента — что происходит сейчас и что вызывает дискомфорт", icon: Icon.Target, color: C.teal },
    { letter: "C", title: "Causes", desc: "Исследуем глубинные причины — убеждения, паттерны и корневые факторы", icon: Icon.BookOpen, color: C.navy },
    { letter: "O", title: "Outcomes", desc: "Формулируем желаемый результат — конкретный, измеримый и вдохновляющий", icon: Icon.Zap, color: C.rose },
    { letter: "R", title: "Resources", desc: "Находим внутренние и внешние ресурсы для достижения цели", icon: Icon.Heart, color: C.tealLight },
    { letter: "E", title: "Effects", desc: "Интегрируем изменения в жизнь клиента и проверяем экологичность результата", icon: Icon.Award, color: C.roseHover },
  ];

  return (
    <section id="method" style={{ background: C.cream, padding: "100px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.rose, marginBottom: 16 }}>
              Методология
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 44, fontWeight: 600, color: C.ink, margin: 0, letterSpacing: "-0.02em" }}>
              Метод SCORE
            </h2>
            <p style={{ fontFamily: sans, fontSize: 16, color: C.inkSoft, maxWidth: 560, margin: "16px auto 0", lineHeight: 1.7 }}>
              Пять шагов системного подхода к трансформации, разработанные Робертом Дилтсом
            </p>
          </div>
        </Reveal>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {steps.map((step, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div
                style={{
                  display: "grid", gridTemplateColumns: "80px 1fr", gap: 28,
                  alignItems: "center",
                  background: C.white, borderRadius: 20, padding: "32px 36px",
                  border: `1px solid ${C.border}`,
                  transition: "all 0.35s ease",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = step.color;
                  e.currentTarget.style.boxShadow = `0 8px 32px ${step.color}15`;
                  e.currentTarget.style.transform = "translateX(6px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                <div style={{
                  width: 72, height: 72, borderRadius: 18,
                  background: `${step.color}12`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: serif, fontSize: 36, fontWeight: 700, color: step.color,
                }}>
                  {step.letter}
                </div>
                <div>
                  <h3 style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: C.ink, margin: 0, marginBottom: 6 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontFamily: sans, fontSize: 15, color: C.inkSoft, margin: 0, lineHeight: 1.6, maxWidth: 520 }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── PROGRAMS ─── */
function Programs() {
  const programs = [
    {
      badge: "Популярная",
      title: "SCORE Practitioner",
      subtitle: "Сертификация ACC",
      duration: "4 месяца",
      hours: "120 часов",
      features: ["Основы метода SCORE", "40+ часов практики", "Групповой менторинг", "Супервизии от PCC коучей", "Доступ к LMS платформе"],
      price: "180 000",
      accent: C.teal,
    },
    {
      badge: "Флагман",
      title: "SCORE Professional",
      subtitle: "Сертификация PCC",
      duration: "9 месяцев",
      hours: "240 часов",
      features: ["Глубокое погружение в SCORE", "80+ часов практики", "Персональный ментор PCC", "Работа с реальными клиентами", "Международная сертификация ICF"],
      price: "340 000",
      accent: C.rose,
      featured: true,
    },
    {
      badge: "Продвинутая",
      title: "SCORE Mastery",
      subtitle: "Путь к MCC",
      duration: "12 месяцев",
      hours: "360 часов",
      features: ["Мастерский уровень SCORE", "120+ часов практики", "Наставничество от MCC", "Создание авторской методики", "Менторинг начинающих коучей"],
      price: "520 000",
      accent: C.navy,
    },
  ];

  return (
    <section id="programs" style={{ background: C.white, padding: "100px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.rose, marginBottom: 16 }}>
              Программы обучения
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 44, fontWeight: 600, color: C.ink, margin: 0, letterSpacing: "-0.02em" }}>
              Выберите свой путь
            </h2>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28, alignItems: "stretch" }}>
          {programs.map((p, i) => (
            <Reveal key={i} delay={i * 0.12}>
              <div style={{
                background: p.featured ? `linear-gradient(160deg, ${C.teal}, ${C.navy})` : C.white,
                borderRadius: 24,
                padding: 36,
                border: p.featured ? "none" : `1px solid ${C.border}`,
                boxShadow: p.featured ? `0 24px 64px rgba(47,84,104,0.2)` : "0 4px 16px rgba(0,0,0,0.04)",
                display: "flex", flexDirection: "column",
                transition: "transform 0.3s, box-shadow 0.3s",
                position: "relative",
                overflow: "hidden",
                height: "100%",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = p.featured ? "0 32px 80px rgba(47,84,104,0.28)" : "0 12px 40px rgba(0,0,0,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = p.featured ? "0 24px 64px rgba(47,84,104,0.2)" : "0 4px 16px rgba(0,0,0,0.04)"; }}
              >
                {p.featured && (
                  <div style={{
                    position: "absolute", top: -40, right: -40,
                    width: 120, height: 120, borderRadius: "50%",
                    background: "rgba(215,166,151,0.12)",
                  }} />
                )}

                <div style={{
                  display: "inline-flex", alignSelf: "flex-start",
                  padding: "5px 14px", borderRadius: 100,
                  background: p.featured ? "rgba(215,166,151,0.2)" : `${p.accent}10`,
                  marginBottom: 20,
                }}>
                  <span style={{
                    fontFamily: sans, fontSize: 12, fontWeight: 600,
                    color: p.featured ? C.rose : p.accent,
                    letterSpacing: "0.03em",
                  }}>
                    {p.badge}
                  </span>
                </div>

                <h3 style={{
                  fontFamily: serif, fontSize: 26, fontWeight: 600,
                  color: p.featured ? C.white : C.ink,
                  margin: 0, marginBottom: 4,
                }}>
                  {p.title}
                </h3>
                <div style={{
                  fontFamily: sans, fontSize: 14,
                  color: p.featured ? "rgba(255,255,255,0.65)" : C.inkMuted,
                  marginBottom: 20,
                }}>
                  {p.subtitle}
                </div>

                <div style={{
                  display: "flex", gap: 16, marginBottom: 24,
                  padding: "14px 0", borderTop: `1px solid ${p.featured ? "rgba(255,255,255,0.12)" : C.border}`,
                  borderBottom: `1px solid ${p.featured ? "rgba(255,255,255,0.12)" : C.border}`,
                }}>
                  <div>
                    <div style={{ fontFamily: sans, fontSize: 12, color: p.featured ? "rgba(255,255,255,0.5)" : C.inkMuted }}>Срок</div>
                    <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: p.featured ? C.white : C.ink }}>{p.duration}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: sans, fontSize: 12, color: p.featured ? "rgba(255,255,255,0.5)" : C.inkMuted }}>Объём</div>
                    <div style={{ fontFamily: sans, fontSize: 14, fontWeight: 600, color: p.featured ? C.white : C.ink }}>{p.hours}</div>
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  {p.features.map((f, fi) => (
                    <div key={fi} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: p.featured ? "rgba(215,166,151,0.2)" : `${p.accent}10`,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}>
                        <Icon.Check size={13} color={p.featured ? C.rose : p.accent} />
                      </div>
                      <span style={{
                        fontFamily: sans, fontSize: 14,
                        color: p.featured ? "rgba(255,255,255,0.85)" : C.inkSoft,
                      }}>
                        {f}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 28 }}>
                  <div style={{ marginBottom: 16 }}>
                    <span style={{
                      fontFamily: serif, fontSize: 32, fontWeight: 600,
                      color: p.featured ? C.white : C.ink,
                    }}>
                      {p.price}
                    </span>
                    <span style={{
                      fontFamily: sans, fontSize: 14,
                      color: p.featured ? "rgba(255,255,255,0.5)" : C.inkMuted,
                      marginLeft: 4,
                    }}>
                      ₽
                    </span>
                  </div>
                  <a href="#" style={{
                    display: "block", textAlign: "center",
                    fontFamily: sans, fontSize: 15, fontWeight: 600,
                    textDecoration: "none",
                    padding: "14px 28px", borderRadius: 12,
                    color: p.featured ? C.teal : C.white,
                    background: p.featured ? C.white : `linear-gradient(135deg, ${p.accent}, ${p.accent}dd)`,
                    boxShadow: p.featured ? "0 4px 16px rgba(255,255,255,0.2)" : `0 4px 16px ${p.accent}30`,
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    Записаться на программу
                  </a>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── TESTIMONIALS ─── */
function Testimonials() {
  const [active, setActive] = useState(0);
  const testimonials = [
    {
      name: "Анна Коваленко",
      role: "Executive коуч, PCC ICF",
      text: "SCORE Academy полностью изменила мой подход к коучингу. Глубина метода поразительна — я наконец-то чувствую уверенность в каждой сессии. Практика с реальными клиентами под супервизией — бесценный опыт.",
      initials: "АК",
      color: C.teal,
    },
    {
      name: "Михаил Дорохов",
      role: "Бизнес-коуч, ACC ICF",
      text: "Пришёл из бизнеса без опыта в коучинге. Структура программы идеальна для начинающих — каждый модуль логично вытекает из предыдущего. Через полгода у меня уже были первые платящие клиенты.",
      initials: "МД",
      color: C.rose,
    },
    {
      name: "Елена Старкова",
      role: "Лайф-коуч, PCC ICF",
      text: "Менторинг в SCORE Academy — это то, что отличает её от других школ. Мой ментор не просто давал обратную связь, а помогал увидеть мои слепые зоны и расти как личности и как профессионалу.",
      initials: "ЕС",
      color: C.navy,
    },
  ];

  return (
    <section id="testimonials" style={{
      background: `linear-gradient(160deg, ${C.teal}, ${C.navy})`,
      padding: "100px 0", position: "relative", overflow: "hidden",
    }}>
      {/* Decorative */}
      <div style={{
        position: "absolute", top: "10%", right: "5%",
        width: 300, height: 300, borderRadius: "50%",
        background: "rgba(215,166,151,0.06)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "10%", left: "5%",
        width: 200, height: 200, borderRadius: "50%",
        background: "rgba(255,255,255,0.03)", pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", position: "relative", zIndex: 2 }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.rose, marginBottom: 16 }}>
              Отзывы выпускников
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 44, fontWeight: 600, color: C.white, margin: 0, letterSpacing: "-0.02em" }}>
              Истории трансформации
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div style={{
            maxWidth: 720, margin: "0 auto",
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(20px)",
            borderRadius: 24, padding: "48px 48px 40px",
            border: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
          }}>
            <div style={{ position: "absolute", top: 32, left: 40 }}>
              <Icon.Quote size={48} color={C.rose} />
            </div>

            <div style={{ position: "relative", zIndex: 2 }}>
              <p style={{
                fontFamily: serif, fontSize: 20, fontStyle: "italic",
                color: "rgba(255,255,255,0.9)", lineHeight: 1.7,
                margin: 0, marginBottom: 32,
                minHeight: 100,
              }}>
                "{testimonials[active].text}"
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${testimonials[active].color}, ${testimonials[active].color}bb)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: sans, fontSize: 14, fontWeight: 600, color: C.white,
                }}>
                  {testimonials[active].initials}
                </div>
                <div>
                  <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 600, color: C.white }}>
                    {testimonials[active].name}
                  </div>
                  <div style={{ fontFamily: sans, fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                    {testimonials[active].role}
                  </div>
                </div>
              </div>
            </div>

            {/* Dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 32 }}>
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  style={{
                    width: i === active ? 32 : 10,
                    height: 10,
                    borderRadius: 100,
                    background: i === active ? C.rose : "rgba(255,255,255,0.2)",
                    border: "none", cursor: "pointer",
                    transition: "all 0.35s ease",
                  }}
                />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── FEATURES GRID ─── */
function Features() {
  const items = [
    { icon: Icon.BookOpen, title: "Структурированная программа", desc: "Пошаговый путь от основ до мастерства с ясными контрольными точками на каждом этапе" },
    { icon: Icon.Users, title: "Живое сообщество", desc: "Закрытое комьюнити коучей, еженедельные практикумы и нетворкинг с единомышленниками" },
    { icon: Icon.Target, title: "Практика с первого дня", desc: "Реальные клиенты, супервизии, разбор сессий — навыки закрепляются через действие" },
    { icon: Icon.Award, title: "Международная сертификация", desc: "Программы аккредитованы ICF. Ваш диплом признаётся в 150+ странах мира" },
    { icon: Icon.Zap, title: "Современная LMS платформа", desc: "Видеоуроки, интерактивные задания, трекер прогресса — учитесь в удобном темпе" },
    { icon: Icon.Heart, title: "Персональная поддержка", desc: "Ментор, куратор и группа поддержки сопровождают вас на протяжении всего обучения" },
  ];

  return (
    <section style={{ background: C.cream, padding: "100px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.rose, marginBottom: 16 }}>
              Преимущества
            </div>
            <h2 style={{ fontFamily: serif, fontSize: 44, fontWeight: 600, color: C.ink, margin: 0, letterSpacing: "-0.02em" }}>
              Почему выбирают нас
            </h2>
          </div>
        </Reveal>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {items.map((item, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div style={{
                background: C.white, borderRadius: 20, padding: 32,
                border: `1px solid ${C.border}`,
                transition: "all 0.3s ease",
                cursor: "default",
                height: "100%",
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.rose;
                  e.currentTarget.style.boxShadow = "0 12px 40px rgba(215,166,151,0.1)";
                  e.currentTarget.style.transform = "translateY(-4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.tealPale}, ${C.rosePale})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                }}>
                  <item.icon size={24} color={C.teal} />
                </div>
                <h3 style={{ fontFamily: serif, fontSize: 20, fontWeight: 600, color: C.ink, margin: 0, marginBottom: 10 }}>
                  {item.title}
                </h3>
                <p style={{ fontFamily: sans, fontSize: 14, color: C.inkSoft, margin: 0, lineHeight: 1.7 }}>
                  {item.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─── */
function CTA() {
  return (
    <section id="pricing" style={{ background: C.white, padding: "100px 0" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
        <Reveal>
          <div style={{
            background: `linear-gradient(160deg, ${C.cream}, ${C.rosePale})`,
            borderRadius: 32, padding: "72px 64px",
            textAlign: "center", position: "relative", overflow: "hidden",
            border: `1px solid ${C.border}`,
          }}>
            {/* Decorative */}
            <div style={{
              position: "absolute", top: -60, right: -60,
              width: 200, height: 200, borderRadius: "50%",
              background: `radial-gradient(circle, ${C.tealPale}, transparent)`,
              opacity: 0.5,
            }} />
            <div style={{
              position: "absolute", bottom: -40, left: -40,
              width: 160, height: 160, borderRadius: "50%",
              background: `radial-gradient(circle, ${C.roseLight}, transparent)`,
              opacity: 0.5,
            }} />

            <div style={{ position: "relative", zIndex: 2 }}>
              <h2 style={{
                fontFamily: serif, fontSize: 44, fontWeight: 600,
                color: C.ink, margin: 0, marginBottom: 16,
                letterSpacing: "-0.02em",
              }}>
                Готовы начать свой путь?
              </h2>
              <p style={{
                fontFamily: sans, fontSize: 17, color: C.inkSoft,
                maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.7,
              }}>
                Запишитесь на бесплатную консультацию — расскажем о программах, ответим на вопросы и поможем выбрать оптимальный формат
              </p>

              <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                <a href="#" style={{
                  fontFamily: sans, fontSize: 16, fontWeight: 600,
                  color: C.white, background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`,
                  padding: "16px 40px", borderRadius: 12,
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10,
                  boxShadow: `0 8px 32px rgba(47,84,104,0.25)`,
                  transition: "transform 0.25s, box-shadow 0.25s",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(47,84,104,0.35)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(47,84,104,0.25)"; }}
                >
                  Записаться на консультацию
                  <Icon.ArrowRight size={18} color={C.white} />
                </a>
                <a href="#" style={{
                  fontFamily: sans, fontSize: 16, fontWeight: 500,
                  color: C.teal, background: C.white,
                  padding: "16px 32px", borderRadius: 12,
                  textDecoration: "none", border: `1px solid ${C.border}`,
                  transition: "all 0.25s",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.teal; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                >
                  Скачать программу (PDF)
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─── FOOTER ─── */
function Footer() {
  return (
    <footer style={{
      background: C.ink, padding: "64px 0 32px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 48 }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.teal}, ${C.navy})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.white, fontFamily: serif, fontSize: 16, fontWeight: 600,
              }}>S</div>
              <span style={{ fontFamily: serif, fontSize: 18, fontWeight: 600, color: C.white }}>
                SCORE Academy
              </span>
            </div>
            <p style={{ fontFamily: sans, fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, maxWidth: 280 }}>
              Международная школа коучинга. Сертифицированные программы обучения ICF с 2014 года.
            </p>
          </div>

          {/* Columns */}
          {[
            { title: "Программы", links: ["SCORE Practitioner", "SCORE Professional", "SCORE Mastery", "Корпоративное обучение"] },
            { title: "Академия", links: ["О методе SCORE", "Преподаватели", "Блог", "Вакансии"] },
            { title: "Поддержка", links: ["Контакты", "FAQ", "Политика конфиденциальности", "Оферта"] },
          ].map((col, ci) => (
            <div key={ci}>
              <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: C.rose, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 20 }}>
                {col.title}
              </div>
              {col.links.map((link, li) => (
                <a key={li} href="#" style={{
                  display: "block", fontFamily: sans, fontSize: 14,
                  color: "rgba(255,255,255,0.5)", textDecoration: "none",
                  marginBottom: 12, transition: "color 0.25s",
                }}
                  onMouseEnter={(e) => (e.target.style.color = "rgba(255,255,255,0.85)")}
                  onMouseLeave={(e) => (e.target.style.color = "rgba(255,255,255,0.5)")}
                >
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontFamily: sans, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
            © 2026 SCORE Coaching Academy. Все права защищены.
          </span>
          <div style={{ display: "flex", gap: 16 }}>
            {["Telegram", "Instagram", "YouTube"].map((s) => (
              <a key={s} href="#" style={{
                fontFamily: sans, fontSize: 13, color: "rgba(255,255,255,0.35)",
                textDecoration: "none", transition: "color 0.25s",
              }}
                onMouseEnter={(e) => (e.target.style.color = C.rose)}
                onMouseLeave={(e) => (e.target.style.color = "rgba(255,255,255,0.35)")}
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════════════════════════════ */
export default function LandingReginaButler() {
  return (
    <div style={{ margin: 0, padding: 0, minHeight: "100vh", background: C.cream }}>
      {/* Global keyframes */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { overflow-x: hidden; }

        @media (max-width: 900px) {
          .nav-desktop { display: none !important; }
          .nav-burger { display: flex !important; }
        }
        @media (min-width: 901px) {
          .nav-burger { display: none !important; }
        }
      `}</style>

      <Nav />
      <Hero />
      <Stats />
      <Method />
      <Programs />
      <Testimonials />
      <Features />
      <CTA />
      <Footer />
    </div>
  );
}
