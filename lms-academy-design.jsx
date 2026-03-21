import { useState, useEffect, useRef, createContext, useContext } from "react";

/* ═══════════════════════════════════════════════════════════════
   SCORE Coaching Academy — LMS Design System & Prototype
   Две палитры с переключателем:

   ТЕМА 1 — «SCORE» (из брифа заказчика):
   #2E2E2E, #F4F3EF, #8FA89B, #4E6F64, #3F3A44, #B36A5E

   ТЕМА 2 — «Regina Butler» (reginabutler.com):
   #2B2C2E, #F4F0EF, #2F5468, #D7A697, #304F68, #D7A697
   ═══════════════════════════════════════════════════════════════ */

const THEMES = {
  score: {
    name: "SCORE",
    text: "#2E2E2E",
    textSecondary: "#6B6B6B",
    textMuted: "#9A9A96",
    milk: "#F4F3EF",
    milkDarker: "#ECEAE4",
    sage: "#8FA89B",
    sageLighter: "#C2D4CA",
    sageSubtle: "#E8F0EC",
    forest: "#4E6F64",
    forestHover: "#3D5A51",
    forestLight: "#D2E0DA",
    plum: "#3F3A44",
    plumLight: "#E8E6EB",
    terra: "#B36A5E",
    terraLight: "#F0DDD9",
    notification: "#B36A5E",
    white: "#FFFFFF",
    border: "#E2E0DB",
    borderLight: "#EEEDEA",
    success: "#6B9E7D",
    warning: "#D4A844",
    sidebarText: "rgba(255,255,255,0.75)",
    sidebarTextActive: "#FFFFFF",
    sidebarDivider: "rgba(255,255,255,0.15)",
    sidebarActiveBg: "rgba(255,255,255,0.2)",
    sidebarHoverBg: "rgba(255,255,255,0.1)",
  },
  regina: {
    name: "Regina Butler",
    text: "#2B2C2E",
    textSecondary: "#5A5A5E",
    textMuted: "#8E8E92",
    milk: "#F4F0EF",
    milkDarker: "#EBE5E3",
    sage: "#2F5468",
    sageLighter: "#5A8BA5",
    sageSubtle: "#E8EFF3",
    forest: "#D7A697",
    forestHover: "#C4907F",
    forestLight: "#F0DDD9",
    plum: "#304F68",
    plumLight: "#D6E2EC",
    terra: "#D7A697",
    terraLight: "#F5E6E1",
    notification: "#B36A5E",
    white: "#FFFFFF",
    border: "#E0DCDA",
    borderLight: "#EDE9E7",
    success: "#6B9E7D",
    warning: "#D4A844",
    sidebarText: "rgba(255,255,255,0.75)",
    sidebarTextActive: "#FFFFFF",
    sidebarDivider: "rgba(255,255,255,0.12)",
    sidebarActiveBg: "rgba(215,166,151,0.25)",
    sidebarHoverBg: "rgba(255,255,255,0.08)",
  },
};

const ThemeContext = createContext(THEMES.score);
const useTheme = () => useContext(ThemeContext);

/* Legacy compat — for code that still references COLORS directly */
const COLORS = THEMES.score;

/* ─── Icons (inline SVG) ─── */
const Icons = {
  Home: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Book: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
    </svg>
  ),
  Calendar: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  Chat: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
  Award: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
    </svg>
  ),
  User: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Play: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  Lock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  Search: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Bell: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Settings: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
  FileText: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  Video: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  ArrowLeft: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  ),
  Star: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  Layers: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
};

/* ─── Google Fonts loader ─── */
const fontLink = document.createElement("link");
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Playfair+Display:wght@500;600&display=swap";
fontLink.rel = "stylesheet";
if (!document.querySelector(`link[href="${fontLink.href}"]`)) {
  document.head.appendChild(fontLink);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════════════════ */
export default function AcademyLMS() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [themeName, setThemeName] = useState("score");
  const theme = THEMES[themeName];

  const navigateToCourse = (course) => {
    setSelectedCourse(course);
    setSelectedLesson(null);
    setCurrentPage("course");
  };

  const navigateToLesson = (lesson) => {
    setSelectedLesson(lesson);
    setCurrentPage("lesson");
  };

  const goBack = () => {
    if (currentPage === "lesson") {
      setCurrentPage("course");
      setSelectedLesson(null);
    } else if (currentPage === "course") {
      setCurrentPage("catalog");
      setSelectedCourse(null);
    } else {
      setCurrentPage("dashboard");
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      <div style={{
        display: "flex",
        height: "100vh",
        fontFamily: "'DM Sans', -apple-system, sans-serif",
        color: theme.text,
        background: theme.milk,
        overflow: "hidden",
        transition: "background 0.4s ease, color 0.4s ease",
      }}>
        {/* ─── Sidebar ─── */}
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={(p) => { setCurrentPage(p); setSelectedCourse(null); setSelectedLesson(null); }}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />

        {/* ─── Main Content ─── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <TopBar themeName={themeName} setThemeName={setThemeName} />
          <div style={{ flex: 1, overflow: "auto", padding: "28px 36px" }}>
            {currentPage === "dashboard" && <DashboardPage onNavigate={navigateToCourse} onPageChange={setCurrentPage} />}
            {currentPage === "catalog" && <CatalogPage onNavigate={navigateToCourse} />}
            {currentPage === "course" && selectedCourse && <CoursePage course={selectedCourse} onLessonSelect={navigateToLesson} onBack={goBack} />}
            {currentPage === "lesson" && selectedLesson && <LessonPage lesson={selectedLesson} course={selectedCourse} onBack={goBack} />}
            {currentPage === "schedule" && <SchedulePage />}
            {currentPage === "chat" && <ChatPage />}
            {currentPage === "certificates" && <CertificatesPage />}
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════════════════ */
function Sidebar({ currentPage, setCurrentPage, collapsed, setCollapsed }) {
  const C = useTheme();
  const navItems = [
    { id: "dashboard", label: "Главная", icon: Icons.Home },
    { id: "catalog", label: "Каталог курсов", icon: Icons.Book },
    { id: "schedule", label: "Расписание", icon: Icons.Calendar },
    { id: "chat", label: "Сообщения", icon: Icons.Chat, badge: 3 },
    { id: "certificates", label: "Сертификаты", icon: Icons.Award },
  ];

  return (
    <div style={{
      width: collapsed ? 72 : 260,
      minWidth: collapsed ? 72 : 260,
      background: C.sage,
      display: "flex",
      flexDirection: "column",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      borderRight: `1px solid ${C.sageLighter}`,
    }}>
      {/* Logo */}
      <div
        style={{
          padding: collapsed ? "24px 16px" : "24px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          borderBottom: `1px solid ${C.sidebarDivider}`,
        }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: C.forest,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: C.white, fontSize: 16, fontWeight: 600, fontFamily: "'Playfair Display', serif" }}>S</span>
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.sidebarTextActive, letterSpacing: "0.02em" }}>
              SCORE
            </div>
            <div style={{ fontSize: 11, color: C.sidebarText, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Academy
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ padding: "16px 12px", flex: 1 }}>
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: collapsed ? "12px 16px" : "11px 16px",
                marginBottom: 4,
                borderRadius: 10,
                cursor: "pointer",
                background: isActive ? C.sidebarActiveBg : "transparent",
                color: isActive ? C.sidebarTextActive : C.sidebarText,
                transition: "all 0.2s ease",
                position: "relative",
                justifyContent: collapsed ? "center" : "flex-start",
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.sidebarHoverBg; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <item.icon />
              {!collapsed && (
                <span style={{ fontSize: 14, fontWeight: isActive ? 500 : 400 }}>{item.label}</span>
              )}
              {item.badge && !collapsed && (
                <span style={{
                  marginLeft: "auto",
                  background: C.notification,
                  color: C.white,
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 10,
                  padding: "2px 8px",
                  minWidth: 20,
                  textAlign: "center",
                }}>
                  {item.badge}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* User */}
      {!collapsed && (
        <div style={{
          padding: "16px 20px",
          borderTop: `1px solid ${C.sidebarDivider}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: C.forest,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 600,
            color: C.white,
          }}>
            АИ
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.sidebarTextActive }}>Анна Иванова</div>
            <div style={{ fontSize: 11, color: C.sidebarText }}>Студент</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP BAR
   ═══════════════════════════════════════════════════════════════ */
function ThemeSwitcher({ themeName, setThemeName }) {
  const C = useTheme();
  const isRegina = themeName === "regina";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: C.milk,
      borderRadius: 12,
      padding: "6px 8px",
      border: `1px solid ${C.border}`,
    }}>
      <button
        onClick={() => setThemeName("score")}
        style={{
          padding: "6px 14px",
          borderRadius: 8,
          border: "none",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
          background: !isRegina ? THEMES.score.forest : "transparent",
          color: !isRegina ? "#FFFFFF" : C.textSecondary,
          transition: "all 0.25s ease",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: THEMES.score.sage,
          border: "1.5px solid " + THEMES.score.forest,
          display: "inline-block", flexShrink: 0,
        }} />
        SCORE
      </button>
      <button
        onClick={() => setThemeName("regina")}
        style={{
          padding: "6px 14px",
          borderRadius: 8,
          border: "none",
          fontSize: 12,
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
          background: isRegina ? THEMES.regina.sage : "transparent",
          color: isRegina ? "#FFFFFF" : C.textSecondary,
          transition: "all 0.25s ease",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: THEMES.regina.terra,
          border: "1.5px solid " + THEMES.regina.sage,
          display: "inline-block", flexShrink: 0,
        }} />
        Regina Butler
      </button>
    </div>
  );
}

function TopBar({ themeName, setThemeName }) {
  const C = useTheme();
  return (
    <div style={{
      height: 64,
      minHeight: 64,
      background: C.white,
      borderBottom: `1px solid ${C.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 36px",
      transition: "all 0.4s ease",
    }}>
      {/* Search */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: C.milk,
        borderRadius: 10,
        padding: "9px 16px",
        width: 320,
        border: `1px solid ${C.borderLight}`,
      }}>
        <span style={{ color: C.textMuted }}><Icons.Search /></span>
        <span style={{ fontSize: 14, color: C.textMuted }}>Поиск курсов, уроков...</span>
      </div>

      {/* Theme Switcher — center */}
      <ThemeSwitcher themeName={themeName} setThemeName={setThemeName} />

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: C.textSecondary,
          position: "relative",
        }}>
          <Icons.Bell />
          <div style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: C.notification,
            border: `2px solid ${C.white}`,
          }} />
        </div>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: C.textSecondary,
        }}>
          <Icons.Settings />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════════ */
function DashboardPage({ onNavigate, onPageChange }) {
  const C = useTheme();
  const myCourses = MOCK_COURSES.slice(0, 3);
  const upcomingClasses = [
    { id: 1, title: "Супервизия группы B", teacher: "Елена Козлова", time: "Сегодня, 18:00", type: "live" },
    { id: 2, title: "Практика GROW-модели", teacher: "Михаил Петров", time: "Завтра, 10:00", type: "practice" },
    { id: 3, title: "Экзамен: Модуль 3", teacher: "Система", time: "Пт, 14:00", type: "exam" },
  ];

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 26,
          fontWeight: 600,
          fontFamily: "'Playfair Display', serif",
          margin: 0,
          color: C.text,
        }}>
          Добро пожаловать, Анна
        </h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: "8px 0 0", lineHeight: 1.5 }}>
          У вас 2 активных курса и 1 занятие сегодня
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 36 }}>
        {[
          { label: "Пройдено уроков", value: "24", sub: "из 86", accent: C.forest },
          { label: "Часов обучения", value: "36.5", sub: "за месяц", accent: C.sage },
          { label: "Средний балл", value: "4.7", sub: "из 5.0", accent: C.warning },
          { label: "Сертификатов", value: "1", sub: "получен", accent: C.terra },
        ].map((stat, i) => (
          <div key={i} style={{
            background: C.white,
            borderRadius: 14,
            padding: "22px 24px",
            border: `1px solid ${C.border}`,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: stat.accent,
              borderRadius: "14px 14px 0 0",
            }} />
            <div style={{ fontSize: 12, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              {stat.label}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: C.text }}>{stat.value}</span>
              <span style={{ fontSize: 13, color: C.textMuted }}>{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 28 }}>
        {/* My Courses */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Мои курсы</h2>
            <span
              style={{ fontSize: 13, color: C.forest, cursor: "pointer", fontWeight: 500 }}
              onClick={() => onPageChange("catalog")}
            >
              Все курсы →
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {myCourses.map((course) => (
              <div
                key={course.id}
                onClick={() => onNavigate(course)}
                style={{
                  background: C.white,
                  borderRadius: 14,
                  padding: "20px 24px",
                  border: `1px solid ${C.border}`,
                  cursor: "pointer",
                  display: "flex",
                  gap: 20,
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = C.sage;
                  e.currentTarget.style.boxShadow = "0 2px 12px rgba(143,168,155,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = C.border;
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                  background: course.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 24,
                }}>
                  {course.emoji}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{course.title}</div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 10 }}>{course.teacher}</div>

                  {/* Progress bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      flex: 1,
                      height: 6,
                      background: C.milkDarker,
                      borderRadius: 3,
                      overflow: "hidden",
                    }}>
                      <div style={{
                        width: `${course.progress}%`,
                        height: "100%",
                        background: course.progress === 100 ? C.success : C.forest,
                        borderRadius: 3,
                        transition: "width 0.5s ease",
                      }} />
                    </div>
                    <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 500, minWidth: 35 }}>
                      {course.progress}%
                    </span>
                  </div>
                </div>

                <span style={{ color: C.textMuted }}><Icons.ChevronRight /></span>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Ближайшие занятия</h2>
            <span
              style={{ fontSize: 13, color: C.forest, cursor: "pointer", fontWeight: 500 }}
              onClick={() => onPageChange("schedule")}
            >
              Расписание →
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcomingClasses.map((cls) => (
              <div key={cls.id} style={{
                background: C.white,
                borderRadius: 14,
                padding: "18px 20px",
                border: `1px solid ${C.border}`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{cls.title}</div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: "3px 10px",
                    borderRadius: 6,
                    background: cls.type === "live" ? C.sageSubtle : cls.type === "exam" ? C.terraLight : C.forestLight,
                    color: cls.type === "live" ? C.forest : cls.type === "exam" ? C.terra : C.forest,
                  }}>
                    {cls.type === "live" ? "Онлайн" : cls.type === "exam" ? "Экзамен" : "Практика"}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4 }}>{cls.teacher}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMuted, fontSize: 12 }}>
                  <Icons.Clock />
                  {cls.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CATALOG PAGE
   ═══════════════════════════════════════════════════════════════ */
function CatalogPage({ onNavigate }) {
  const C = useTheme();
  const [activeFilter, setActiveFilter] = useState("all");
  const filters = [
    { id: "all", label: "Все курсы" },
    { id: "coaching", label: "Коучинг" },
    { id: "psychology", label: "Психология" },
    { id: "supervision", label: "Супервизия" },
    { id: "business", label: "Бизнес" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, fontFamily: "'Playfair Display', serif", margin: 0 }}>
          Каталог курсов
        </h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: "8px 0 0" }}>
          {MOCK_COURSES.length} курсов доступно для изучения
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={{
              padding: "8px 20px",
              borderRadius: 20,
              border: "none",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              background: activeFilter === f.id ? C.forest : C.white,
              color: activeFilter === f.id ? C.white : C.textSecondary,
              transition: "all 0.2s ease",
              fontFamily: "inherit",
              boxShadow: activeFilter === f.id ? "none" : `inset 0 0 0 1px ${C.border}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {MOCK_COURSES.map((course) => (
          <div
            key={course.id}
            onClick={() => onNavigate(course)}
            style={{
              background: C.white,
              borderRadius: 16,
              overflow: "hidden",
              border: `1px solid ${C.border}`,
              cursor: "pointer",
              transition: "all 0.25s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-3px)";
              e.currentTarget.style.boxShadow = "0 8px 30px rgba(78,111,100,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Cover */}
            <div style={{
              height: 160,
              background: course.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              position: "relative",
            }}>
              {course.emoji}
              {course.progress > 0 && (
                <div style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  background: "rgba(255,255,255,0.9)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 8,
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: 500,
                  color: C.forest,
                }}>
                  {course.progress}% пройдено
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ padding: "18px 20px 22px" }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: C.sage, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                {course.category}
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8, lineHeight: 1.4 }}>
                {course.title}
              </div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>
                {course.teacher}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: C.textMuted }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icons.Layers /> {course.modules} мод.
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icons.Clock /> {course.hours}ч
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, color: C.warning }}>
                  <Icons.Star />
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{course.rating}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COURSE PAGE (detail)
   ═══════════════════════════════════════════════════════════════ */
function CoursePage({ course, onLessonSelect, onBack }) {
  const C = useTheme();
  const modules = MOCK_MODULES;

  return (
    <div>
      {/* Back button */}
      <div
        onClick={onBack}
        style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary, cursor: "pointer", marginBottom: 24, fontSize: 14 }}
      >
        <Icons.ArrowLeft /> Назад к каталогу
      </div>

      {/* Header */}
      <div style={{
        background: course.color,
        borderRadius: 18,
        padding: "36px 40px",
        marginBottom: 28,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "rgba(46,46,46,0.5)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            {course.category}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, fontFamily: "'Playfair Display', serif", margin: "0 0 10px", color: C.text }}>
            {course.title}
          </h1>
          <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
            {course.teacher} · {course.modules} модулей · {course.hours} часов
          </p>
        </div>
        <div style={{ fontSize: 64 }}>{course.emoji}</div>
      </div>

      {/* Progress + Content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28 }}>
        {/* Modules list */}
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Программа курса</h2>
          {modules.map((mod, mi) => (
            <div key={mi} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 10,
                padding: "0 4px",
              }}>
                Модуль {mi + 1}: {mod.title}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {mod.lessons.map((lesson, li) => (
                  <div
                    key={li}
                    onClick={() => !lesson.locked && onLessonSelect({ ...lesson, moduleIndex: mi, lessonIndex: li })}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 18px",
                      background: C.white,
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      cursor: lesson.locked ? "default" : "pointer",
                      opacity: lesson.locked ? 0.55 : 1,
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => { if (!lesson.locked) e.currentTarget.style.borderColor = C.sage; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; }}
                  >
                    {/* Status */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: lesson.completed ? C.sageSubtle : lesson.locked ? C.milkDarker : C.forestLight,
                      color: lesson.completed ? C.forest : lesson.locked ? C.textMuted : C.forest,
                      flexShrink: 0,
                    }}>
                      {lesson.completed ? <Icons.Check /> : lesson.locked ? <Icons.Lock /> :
                        lesson.type === "video" ? <Icons.Play /> : <Icons.FileText />}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 450 }}>{lesson.title}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{lesson.type === "video" ? "Видео" : lesson.type === "test" ? "Тест" : "Текст"}</span>
                        <span>·</span>
                        <span>{lesson.duration}</span>
                      </div>
                    </div>

                    {!lesson.locked && <span style={{ color: C.textMuted }}><Icons.ChevronRight /></span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar info */}
        <div>
          <div style={{
            background: C.white,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: "24px",
            position: "sticky",
            top: 28,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 18px" }}>Ваш прогресс</h3>

            {/* Progress ring */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div style={{ position: "relative", width: 120, height: 120 }}>
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke={C.milkDarker} strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={C.forest}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - course.progress / 100)}`}
                    transform="rotate(-90 60 60)"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <div style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <span style={{ fontSize: 28, fontWeight: 600 }}>{course.progress}%</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>пройдено</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Уроков пройдено", value: "8 / 24" },
                { label: "Тестов сдано", value: "2 / 6" },
                { label: "Средний балл", value: "4.8" },
                { label: "Время обучения", value: "12ч 30м" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: C.textSecondary }}>{s.label}</span>
                  <span style={{ fontWeight: 500 }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Continue button */}
            <button style={{
              width: "100%",
              marginTop: 24,
              padding: "13px",
              background: C.forest,
              color: C.white,
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s ease",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.forestHover}
              onMouseLeave={(e) => e.currentTarget.style.background = C.forest}
            >
              Продолжить обучение
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LESSON PAGE
   ═══════════════════════════════════════════════════════════════ */
function LessonPage({ lesson, course, onBack }) {
  const C = useTheme();
  const [activeTab, setActiveTab] = useState("content");

  return (
    <div>
      {/* Back */}
      <div onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, color: C.textSecondary, cursor: "pointer", marginBottom: 20, fontSize: 14 }}>
        <Icons.ArrowLeft /> {course.title}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 28 }}>
        {/* Main content */}
        <div>
          {/* Video player mockup */}
          {lesson.type === "video" && (
            <div style={{
              width: "100%",
              aspectRatio: "16/9",
              background: `linear-gradient(135deg, ${C.plum} 0%, ${C.forest} 100%)`,
              borderRadius: 16,
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* Play button */}
              <div style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(12px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "transform 0.2s ease",
              }}>
                <div style={{ color: C.white, marginLeft: 4 }}>
                  <Icons.Play />
                </div>
              </div>
              {/* Duration */}
              <div style={{
                position: "absolute",
                bottom: 16,
                right: 16,
                background: "rgba(0,0,0,0.5)",
                color: C.white,
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 500,
              }}>
                {lesson.duration}
              </div>
              {/* Progress bar */}
              <div style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 4,
                background: "rgba(255,255,255,0.2)",
              }}>
                <div style={{ width: "35%", height: "100%", background: C.terra, borderRadius: "0 2px 2px 0" }} />
              </div>
            </div>
          )}

          {/* Title */}
          <h1 style={{ fontSize: 22, fontWeight: 600, fontFamily: "'Playfair Display', serif", margin: "0 0 8px" }}>
            {lesson.title}
          </h1>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 24, display: "flex", gap: 16 }}>
            <span>Модуль {(lesson.moduleIndex || 0) + 1}, Урок {(lesson.lessonIndex || 0) + 1}</span>
            <span>·</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Icons.Clock /> {lesson.duration}</span>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 24 }}>
            {["content", "homework", "discussion"].map((tab) => (
              <div
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: activeTab === tab ? 500 : 400,
                  color: activeTab === tab ? C.forest : C.textSecondary,
                  borderBottom: activeTab === tab ? `2px solid ${C.forest}` : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  marginBottom: -1,
                }}
              >
                {tab === "content" ? "Материал" : tab === "homework" ? "Домашнее задание" : "Обсуждение"}
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{ fontSize: 15, lineHeight: 1.75, color: C.text }}>
            <p style={{ marginBottom: 18 }}>
              В этом уроке мы разберём ключевые принципы коучинговой беседы по модели GROW (Goal — Reality — Options — Will). Эта модель была разработана Джоном Уитмором и является одной из самых распространённых структур в профессиональном коучинге.
            </p>
            <div style={{
              background: C.sageSubtle,
              borderLeft: `3px solid ${C.sage}`,
              borderRadius: "0 10px 10px 0",
              padding: "18px 22px",
              marginBottom: 20,
              fontSize: 14,
              lineHeight: 1.7,
            }}>
              <strong style={{ display: "block", marginBottom: 6, color: C.forest }}>Ключевой принцип</strong>
              Коуч не даёт советов — он задаёт вопросы, которые помогают клиенту самостоятельно найти решение. GROW-модель структурирует этот процесс.
            </div>
            <p style={{ marginBottom: 18 }}>
              Каждый этап модели имеет свои характерные вопросы и цели. На этапе <strong>Goal</strong> мы помогаем клиенту сформулировать конкретную, измеримую цель сессии. На этапе <strong>Reality</strong> — исследуем текущую ситуацию без оценок и интерпретаций.
            </p>
            <p>
              Этапы <strong>Options</strong> и <strong>Will</strong> направлены на генерацию вариантов действий и принятие конкретных обязательств. Важно не торопить клиента и давать пространство для размышления.
            </p>
          </div>
        </div>

        {/* Right sidebar */}
        <div>
          {/* Navigation */}
          <div style={{
            background: C.white,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: "20px",
            marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px" }}>Содержание модуля</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {["Введение в GROW", "Этап Goal", "Этап Reality", "Этап Options", "Этап Will", "Практическое упражнение"].map((item, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  background: i === 1 ? C.forestLight : "transparent",
                  color: i < 1 ? C.textMuted : i === 1 ? C.forest : C.text,
                  fontWeight: i === 1 ? 500 : 400,
                }}>
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 500,
                    background: i < 1 ? C.sageSubtle : i === 1 ? C.forest : C.milkDarker,
                    color: i < 1 ? C.forest : i === 1 ? C.white : C.textMuted,
                  }}>
                    {i < 1 ? <Icons.Check /> : i + 1}
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Teacher card */}
          <div style={{
            background: C.white,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: "20px",
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 14px" }}>Преподаватель</h3>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: C.sage,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.white,
                fontSize: 14,
                fontWeight: 600,
              }}>
                ЕК
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Елена Козлова</div>
                <div style={{ fontSize: 12, color: C.textSecondary }}>PCC ICF, 12 лет опыта</div>
              </div>
            </div>
            <button style={{
              width: "100%",
              marginTop: 16,
              padding: "10px",
              background: "transparent",
              color: C.forest,
              border: `1px solid ${C.forest}`,
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}>
              Написать сообщение
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCHEDULE PAGE
   ═══════════════════════════════════════════════════════════════ */
function SchedulePage() {
  const C = useTheme();
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const dates = [10, 11, 12, 13, 14, 15, 16];
  const [selectedDay, setSelectedDay] = useState(4);

  const events = [
    { time: "10:00", duration: "1.5ч", title: "Модуль 3: Коучинговые компетенции", type: "lecture", teacher: "Елена Козлова" },
    { time: "14:00", duration: "1ч", title: "Практика в тройках", type: "practice", teacher: "Группа B" },
    { time: "18:00", duration: "2ч", title: "Супервизия: разбор кейсов", type: "supervision", teacher: "Михаил Петров" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, fontFamily: "'Playfair Display', serif", margin: "0 0 8px" }}>
        Расписание
      </h1>
      <p style={{ fontSize: 14, color: C.textSecondary, margin: "0 0 28px" }}>
        Март 2026
      </p>

      {/* Week selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
        {days.map((day, i) => (
          <div
            key={i}
            onClick={() => setSelectedDay(i)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "14px 8px",
              borderRadius: 14,
              cursor: "pointer",
              background: selectedDay === i ? C.forest : C.white,
              color: selectedDay === i ? C.white : C.text,
              border: `1px solid ${selectedDay === i ? C.forest : C.border}`,
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{day}</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{dates[i]}</div>
          </div>
        ))}
      </div>

      {/* Events */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {events.map((ev, i) => (
          <div key={i} style={{
            display: "flex",
            gap: 20,
            background: C.white,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            padding: "22px 24px",
            alignItems: "center",
          }}>
            {/* Time */}
            <div style={{ minWidth: 70, textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{ev.time}</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{ev.duration}</div>
            </div>

            {/* Divider */}
            <div style={{
              width: 3,
              height: 48,
              borderRadius: 2,
              background: ev.type === "lecture" ? C.forest : ev.type === "practice" ? C.sage : C.plum,
            }} />

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>{ev.title}</div>
              <div style={{ fontSize: 13, color: C.textSecondary }}>{ev.teacher}</div>
            </div>

            {/* Action */}
            <button style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: ev.type === "supervision" ? C.plum : C.forest,
              color: C.white,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <Icons.Video />
              Войти
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHAT PAGE
   ═══════════════════════════════════════════════════════════════ */
function ChatPage() {
  const C = useTheme();
  const chats = [
    { id: 1, name: "Елена Козлова", role: "Преподаватель", lastMsg: "Отличная работа на практике! Обратите внимание на...", time: "14:32", unread: 1, avatar: "ЕК" },
    { id: 2, name: "Группа B — Коучинг", role: "Учебная группа", lastMsg: "Кто готов к практике в тройках завтра?", time: "12:15", unread: 3, avatar: "ГБ" },
    { id: 3, name: "Михаил Петров", role: "Супервизор", lastMsg: "Запись супервизии доступна в личном кабинете", time: "Вчера", unread: 0, avatar: "МП" },
    { id: 4, name: "Поддержка Академии", role: "Техподдержка", lastMsg: "Спасибо за обращение! Вопрос решён", time: "Пн", unread: 0, avatar: "ПА" },
  ];

  const [selectedChat, setSelectedChat] = useState(0);

  return (
    <div style={{ display: "flex", gap: 0, margin: "-28px -36px", height: "calc(100vh - 64px)" }}>
      {/* Chat list */}
      <div style={{
        width: 360,
        borderRight: `1px solid ${C.border}`,
        display: "flex",
        flexDirection: "column",
        background: C.white,
      }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.borderLight}` }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 14px" }}>Сообщения</h2>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: C.milk,
            borderRadius: 10,
            padding: "9px 14px",
          }}>
            <span style={{ color: C.textMuted }}><Icons.Search /></span>
            <span style={{ fontSize: 13, color: C.textMuted }}>Поиск...</span>
          </div>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          {chats.map((chat, i) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(i)}
              style={{
                display: "flex",
                gap: 14,
                padding: "16px 24px",
                cursor: "pointer",
                background: selectedChat === i ? C.sageSubtle : "transparent",
                borderLeft: selectedChat === i ? `3px solid ${C.forest}` : "3px solid transparent",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: i === 0 ? C.sage : i === 1 ? C.forest : i === 2 ? C.plum : C.textMuted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.white,
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0,
              }}>
                {chat.avatar}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{chat.name}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{chat.time}</span>
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {chat.lastMsg}
                </div>
              </div>
              {chat.unread > 0 && (
                <div style={{
                  alignSelf: "center",
                  background: C.notification,
                  color: C.white,
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 10,
                  padding: "2px 8px",
                  minWidth: 20,
                  textAlign: "center",
                }}>
                  {chat.unread}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chat window */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: C.milk }}>
        {/* Chat header */}
        <div style={{
          padding: "16px 28px",
          borderBottom: `1px solid ${C.border}`,
          background: C.white,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: C.sage,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: C.white,
            fontSize: 13,
            fontWeight: 600,
          }}>
            {chats[selectedChat].avatar}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{chats[selectedChat].name}</div>
            <div style={{ fontSize: 12, color: C.success }}>Онлайн</div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: "24px 28px", overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <ChatBubble from="them" text="Анна, добрый день! Как прошла практика по GROW-модели?" time="14:28" />
          <ChatBubble from="me" text="Здравствуйте! Очень продуктивно, но на этапе Reality было сложно удерживаться от советов." time="14:30" />
          <ChatBubble from="them" text="Это очень частая ситуация на начальном этапе. Попробуйте технику «зеркалирования» — просто повторяйте ключевые слова клиента в форме вопроса. Это помогает оставаться в позиции исследования." time="14:32" />
        </div>

        {/* Input */}
        <div style={{
          padding: "16px 28px",
          borderTop: `1px solid ${C.border}`,
          background: C.white,
          display: "flex",
          gap: 12,
        }}>
          <div style={{
            flex: 1,
            background: C.milk,
            borderRadius: 12,
            padding: "12px 18px",
            fontSize: 14,
            color: C.textMuted,
            border: `1px solid ${C.borderLight}`,
          }}>
            Написать сообщение...
          </div>
          <button style={{
            padding: "12px 24px",
            borderRadius: 12,
            border: "none",
            background: C.forest,
            color: C.white,
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}>
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ from, text, time }) {
  const C = useTheme();
  const isMe = from === "me";
  return (
    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "65%",
        background: isMe ? C.forest : C.white,
        color: isMe ? C.white : C.text,
        borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        padding: "14px 18px",
        fontSize: 14,
        lineHeight: 1.6,
        boxShadow: isMe ? "none" : `0 1px 4px rgba(0,0,0,0.04)`,
      }}>
        {text}
        <div style={{
          fontSize: 11,
          marginTop: 8,
          opacity: 0.6,
          textAlign: "right",
        }}>
          {time}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CERTIFICATES PAGE
   ═══════════════════════════════════════════════════════════════ */
function CertificatesPage() {
  const C = useTheme();
  const certs = [
    { id: 1, title: "Основы коучинга (ACC)", course: "Профессиональный коучинг: уровень 1", date: "15 января 2026", status: "issued" },
    { id: 2, title: "Психология коммуникации", course: "Психология для коучей", date: "—", status: "in_progress", progress: 67 },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, fontFamily: "'Playfair Display', serif", margin: "0 0 8px" }}>
        Сертификаты
      </h1>
      <p style={{ fontSize: 14, color: C.textSecondary, margin: "0 0 28px" }}>
        Ваши достижения и прогресс
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 20 }}>
        {certs.map((cert) => (
          <div key={cert.id} style={{
            background: C.white,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
            overflow: "hidden",
          }}>
            {/* Certificate header */}
            <div style={{
              height: 120,
              background: cert.status === "issued"
                ? `linear-gradient(135deg, ${C.forest} 0%, ${C.sage} 100%)`
                : `linear-gradient(135deg, ${C.milkDarker} 0%, ${C.sageLighter} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}>
              <div style={{ fontSize: 48, opacity: cert.status === "issued" ? 1 : 0.4 }}>
                <Icons.Award />
              </div>
              {cert.status === "issued" && (
                <div style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  background: "rgba(255,255,255,0.25)",
                  color: C.white,
                  borderRadius: 8,
                  padding: "4px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  Выдан
                </div>
              )}
            </div>

            <div style={{ padding: "22px 24px" }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{cert.title}</div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 14 }}>{cert.course}</div>

              {cert.status === "issued" ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: C.textMuted }}>Дата: {cert.date}</span>
                  <button style={{
                    padding: "8px 18px",
                    borderRadius: 10,
                    border: `1px solid ${C.forest}`,
                    background: "transparent",
                    color: C.forest,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}>
                    Скачать PDF
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: C.textMuted }}>Прогресс</span>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{cert.progress}%</span>
                  </div>
                  <div style={{ height: 6, background: C.milkDarker, borderRadius: 3 }}>
                    <div style={{ width: `${cert.progress}%`, height: "100%", background: C.sage, borderRadius: 3 }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════════ */
const MOCK_COURSES = [
  { id: 1, title: "Профессиональный коучинг: уровень 1", teacher: "Елена Козлова · PCC ICF", category: "Коучинг", modules: 6, hours: 48, rating: 4.9, progress: 35, color: "#E8F0EC", emoji: "🎯" },
  { id: 2, title: "Психология для коучей", teacher: "Михаил Петров · PhD", category: "Психология", modules: 4, hours: 32, rating: 4.8, progress: 67, color: "#D2E0DA", emoji: "🧠" },
  { id: 3, title: "Групповой коучинг и фасилитация", teacher: "Анастасия Волкова · MCC ICF", category: "Коучинг", modules: 5, hours: 40, rating: 4.7, progress: 12, color: "#E8E6EB", emoji: "👥" },
  { id: 4, title: "Супервизия в коучинге", teacher: "Дмитрий Орлов · MCC ICF", category: "Супервизия", modules: 3, hours: 24, rating: 4.9, progress: 0, color: "#F0DDD9", emoji: "🔍" },
  { id: 5, title: "Коучинг в бизнесе", teacher: "Ирина Смирнова · PCC ICF", category: "Бизнес", modules: 5, hours: 36, rating: 4.6, progress: 0, color: "#E8E6EB", emoji: "💼" },
  { id: 6, title: "Эмоциональный интеллект", teacher: "Алексей Новиков · PhD", category: "Психология", modules: 4, hours: 28, rating: 4.8, progress: 0, color: "#E8F0EC", emoji: "💚" },
];

const MOCK_MODULES = [
  {
    title: "Введение в коучинг",
    lessons: [
      { title: "Что такое коучинг?", type: "video", duration: "18 мин", completed: true, locked: false },
      { title: "История и философия коучинга", type: "text", duration: "12 мин", completed: true, locked: false },
      { title: "Тест: основные понятия", type: "test", duration: "10 мин", completed: true, locked: false },
    ],
  },
  {
    title: "Модель GROW",
    lessons: [
      { title: "Обзор модели GROW", type: "video", duration: "22 мин", completed: true, locked: false },
      { title: "Этап Goal: постановка цели", type: "video", duration: "25 мин", completed: false, locked: false },
      { title: "Этап Reality: исследование реальности", type: "video", duration: "20 мин", completed: false, locked: false },
      { title: "Этапы Options и Will", type: "video", duration: "28 мин", completed: false, locked: false },
      { title: "Практика: проведение сессии", type: "text", duration: "45 мин", completed: false, locked: false },
      { title: "Тест: модель GROW", type: "test", duration: "15 мин", completed: false, locked: false },
    ],
  },
  {
    title: "Коучинговые компетенции ICF",
    lessons: [
      { title: "8 ключевых компетенций", type: "video", duration: "30 мин", completed: false, locked: true },
      { title: "Активное слушание", type: "video", duration: "22 мин", completed: false, locked: true },
      { title: "Сильные вопросы", type: "video", duration: "25 мин", completed: false, locked: true },
      { title: "Домашнее задание", type: "text", duration: "1 час", completed: false, locked: true },
    ],
  },
];
