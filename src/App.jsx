import { useEffect, useState } from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { auth, db, googleProvider } from "./firebase";
import {
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
} from "firebase/auth";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const ADMIN_EMAILS = ["admin@kluportal.in", "2400032681@kluniversity.in"];

/* ============ GLOBAL: STUDENT PROFILE SAVE HELPER ============ */

async function saveStudentProfile(user, fullNameFromForm) {
  if (!user) return;

  const nameToSave =
    fullNameFromForm ||
    user.displayName ||
    (user.email ? user.email.split("@")[0] : "");

  const ref = doc(db, "students", user.uid);

  await setDoc(
    ref,
    {
      uid: user.uid,
      name: nameToSave,
      email: user.email || "",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/* ================= ROOT APP ================= */

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);

      const admin = fbUser && ADMIN_EMAILS.includes(fbUser.email || "");
      setIsAdmin(admin);

      // ✅ YAHI SE ensure kar rahe ki har student login hone par students collection me aa jaye
      if (fbUser && !admin) {
        try {
          await saveStudentProfile(fbUser);
        } catch (err) {
          console.error("Error saving student profile:", err);
        }
      }

      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const handleLoggedIn = (asAdmin) => {
    if (asAdmin) navigate("/admin");
    else navigate("/student");
  };

  if (authLoading) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-text">
              <h1>KLXtra – KL University Activities Portal</h1>
              <p>Checking session…</p>
            </div>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="app">
      {/* GLOBAL NAVBAR */}
      <header className="topbar">
        <div className="brand">
          <img src="/klu.png" className="brand-logo-small" alt="KL" />
          <div className="brand-text">
            <h1>KLXtra – KL University Activities Portal</h1>
            <p>Vaddeswaram · Clubs · Sports · Cultural Events</p>
          </div>
        </div>

        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/clubs">Clubs</Link>
          <Link to="/events">Events</Link>
          <Link to="/about">About</Link>
          {user && !isAdmin && <Link to="/student">Student</Link>}
          {user && isAdmin && <Link to="/admin">Admin</Link>}
        </nav>

        <div className="nav-right">
          {user && (
            <span className="badge">
              {isAdmin ? "Admin" : "Student"} · {user.email}
            </span>
          )}
          {user ? (
            <button className="btn secondary small" onClick={logout}>
              Logout
            </button>
          ) : (
            <Link to="/" className="btn primary small">
              Login
            </Link>
          )}
        </div>
      </header>

      {/* ROUTES */}
      <main className="content">
        <Routes>
          <Route
            path="/"
            element={
              !user ? (
                <AuthLanding onLoggedIn={handleLoggedIn} />
              ) : isAdmin ? (
                <Navigate to="/admin" />
              ) : (
                <Navigate to="/student" />
              )
            }
          />

          <Route path="/clubs" element={<ClubsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/about" element={<AboutPage />} />

          <Route
            path="/student"
            element={
              user && !isAdmin ? (
                <StudentPanel />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/admin"
            element={
              user && isAdmin ? <AdminPanel /> : <Navigate to="/" replace />
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

/* ================= HOME + AUTH ================= */

function AuthLanding({ onLoggedIn }) {
  const [tab, setTab] = useState("student");
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isStudentTab = tab === "student";

  // STUDENT LOGIN / REGISTER
  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Enter email & password");
      return;
    }
    try {
      setSubmitting(true);
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        // yaha bhi save kar rahe (extra safety)
        await saveStudentProfile(cred.user, name);

        await sendEmailVerification(cred.user);
        alert(
          "Student account created. Verification link sent.\nVerify email then login."
        );
        await signOut(auth);
        setMode("login");
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (ADMIN_EMAILS.includes(cred.user.email || "")) {
          await signOut(auth);
          alert("This email is admin. Use Admin tab.");
          return;
        }
        if (!cred.user.emailVerified) {
          await sendEmailVerification(cred.user);
          alert("Email not verified. Link sent again.");
          await signOut(auth);
          return;
        }

        // login par bhi update
        await saveStudentProfile(cred.user, name);

        onLoggedIn(false);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // STUDENT GOOGLE LOGIN
  const handleStudentGoogle = async () => {
    try {
      setSubmitting(true);
      const cred = await signInWithPopup(auth, googleProvider);
      if (ADMIN_EMAILS.includes(cred.user.email || "")) {
        await signOut(auth);
        alert("This email is admin. Use Admin login.");
        return;
      }

      // Google login par bhi save
      await saveStudentProfile(cred.user, cred.user.displayName || "");

      onLoggedIn(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ADMIN LOGIN
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Enter email & password");
      return;
    }
    try {
      setSubmitting(true);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!ADMIN_EMAILS.includes(cred.user.email || "")) {
        await signOut(auth);
        alert("Not an admin email.");
        return;
      }
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user);
        alert("Admin email not verified. Verification link sent again.");
        await signOut(auth);
        return;
      }
      onLoggedIn(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-shell">
      {/* mini nav inside hero */}
      <header className="auth-nav">
        <div className="auth-logo">
          <div className="auth-logo-icon">K</div>
          <div className="auth-logo-text">
            <span className="auth-logo-main">KLXtra</span>
            <span className="auth-logo-sub">College Club Portal</span>
          </div>
        </div>

        <nav className="auth-links">
          <a href="#home">Home</a>
          <a href="#clubs">Clubs</a>
          <a href="#events">Events</a>
          <a href="#about">About</a>
        </nav>

        <button className="btn secondary small">Login</button>
      </header>

      <div className="auth-main">
        {/* LEFT HERO */}
        <div className="auth-hero" id="home">
          <img src="/klu.png" alt="KL banner" className="klu-banner" />

          <p className="auth-badge">KL UNIVERSITY · VADDESWARAM</p>
          <h1 className="auth-title">
            <span className="auth-title-highlight">CAREER</span>{" "}
            WHAT&apos;S ON YOUR MIND
          </h1>
          <p className="auth-subtitle">
            Discover clubs, sports and cultural events that shape your profile.
            Build your network, earn certificates and level up your campus life.
          </p>
          <div className="auth-cta-row">
            <Link to="/clubs" className="btn primary">
              Get Started
            </Link>
          </div>
        </div>

        {/* RIGHT LOGIN CARD */}
        <div className="auth-card card">
          <h2>{isStudentTab ? "Student Access" : "Admin Access"}</h2>
          <p className="muted small">
            Use your KL email to sign in. Admin emails are pre-approved.
          </p>

          <div className="tabs">
            <button
              className={`chip ${isStudentTab ? "chip-active" : ""}`}
              onClick={() => setTab("student")}
            >
              Student
            </button>
            <button
              className={`chip ${!isStudentTab ? "chip-active" : ""}`}
              onClick={() => setTab("admin")}
            >
              Admin
            </button>
          </div>

          {isStudentTab ? (
            <>
              <div className="tabs">
                <button
                  className={`chip ${
                    mode === "login" ? "chip-active" : ""
                  }`}
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
                <button
                  className={`chip ${
                    mode === "register" ? "chip-active" : ""
                  }`}
                  onClick={() => setMode("register")}
                >
                  Register
                </button>
              </div>

              <form className="form" onSubmit={handleStudentSubmit}>
                {mode === "register" && (
                  <div className="form-field">
                    <label>Full name</label>
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Om Kumar"
                    />
                  </div>
                )}

                <div className="form-field">
                  <label>Student email</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@kluniversity.in"
                  />
                </div>

                <div className="form-field">
                  <label>Password</label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <button
                  type="submit"
                  className="btn primary"
                  disabled={submitting}
                >
                  {submitting
                    ? "Please wait…"
                    : mode === "login"
                    ? "Login as Student"
                    : "Register as Student"}
                </button>
              </form>

              <div className="or-row">
                <span className="line" />
                <span className="or-text">OR</span>
                <span className="line" />
              </div>

              <button
                className="btn secondary"
                onClick={handleStudentGoogle}
                disabled={submitting}
              >
                Continue with Google
              </button>
            </>
          ) : (
            <>
              <p className="muted small" style={{ marginTop: 10 }}>
                Only pre-approved admin emails can login here.
              </p>

              <form className="form" onSubmit={handleAdminLogin}>
                <div className="form-field">
                  <label>Admin email</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@kluportal.in"
                  />
                </div>

                <div className="form-field">
                  <label>Password</label>
                  <input
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Admin password"
                  />
                </div>

                <button
                  type="submit"
                  className="btn primary"
                  disabled={submitting}
                >
                  {submitting ? "Please wait…" : "Login as Admin"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ================= PAGE SHELL + EXTRA PAGES ================= */

function PageShell({ title, subtitle, children }) {
  return (
    <section className="card page-card">
      <header className="page-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function ClubsPage() {
  const clubs = [
    { emoji: "💻", name: "Coding Club", desc: "Hackathons & coding contests." },
    { emoji: "🎭", name: "Cultural Club", desc: "Dance, music, drama & fests." },
    { emoji: "🏀", name: "Sports Club", desc: "Cricket, football, basketball." },
  ];

  return (
    <PageShell
      title="Campus Clubs"
      subtitle="Join a community that matches your passion."
    >
      <div className="club-grid">
        {clubs.map((c) => (
          <div key={c.name} className="club-card">
            <span className="club-emoji">{c.emoji}</span>
            <h4>{c.name}</h4>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function EventsPage() {
  const events = [
    {
      tag: "Hackathon",
      title: "KLXtra CodeSprint 2025",
      date: "Jan 18–19 · CSE Block",
      desc: "48-hour coding marathon with exciting prizes.",
    },
  ];

  return (
    <PageShell
      title="Static Sample Events"
      subtitle="(Demo section) Dynamic events come from Admin panel."
    >
      <ul className="activity-list">
        {events.map((ev) => (
          <li key={ev.title} className="activity-item">
            <div>
              <div className="activity-title">
                {ev.title}
                <span className="tag">{ev.tag}</span>
              </div>
              <p className="muted small">{ev.date}</p>
              <p className="small">{ev.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

function AboutPage() {
  return (
    <PageShell
      title="About KLXtra"
      subtitle="Official portal for managing KL University extracurricular activities."
    >
      <p className="muted">
        KLXtra connects students with clubs, sports and cultural events.
      </p>
    </PageShell>
  );
}

/* ================= ADMIN PANEL ================= */

function AdminPanel() {
  const [activities, setActivities] = useState([]);
  const [regs, setRegs] = useState([]);
  const [students, setStudents] = useState([]);
  const [regCounts, setRegCounts] = useState({});
  const [totalRegs, setTotalRegs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState("Club");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError("");

      const actSnap = await getDocs(collection(db, "activities"));
      const acts = actSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      acts.sort(
        (a, b) =>
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );
      setActivities(acts);

      const regSnap = await getDocs(collection(db, "registrations"));
      const regList = regSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRegs(regList);

      const counts = {};
      regList.forEach((r) => {
        if (!r.activityId) return;
        counts[r.activityId] = (counts[r.activityId] || 0) + 1;
      });
      setRegCounts(counts);
      setTotalRegs(regList.length);

      const studSnap = await getDocs(collection(db, "students"));
      const studs = studSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStudents(studs);
    } catch (err) {
      console.error("Error loading admin data:", err);
      setError("Failed to load data: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleAddActivity = async (e) => {
    e.preventDefault();

    if (!title.trim() || !date || !location.trim()) {
      alert("Please fill Title, Date and Location.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await addDoc(collection(db, "activities"), {
        title: title.trim(),
        type,
        date,
        location: location.trim(),
        description: description.trim(),
        createdAt: new Date(),
      });

      setTitle("");
      setType("Club");
      setDate("");
      setLocation("");
      setDescription("");
      alert("Activity added successfully ✅");

      await loadAllData();
    } catch (err) {
      console.error("Error adding activity:", err);
      setError("Failed to add activity: " + err.message);
      alert("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const activityMap = activities.reduce((acc, a) => {
    acc[a.id] = a.title;
    return acc;
  }, {});

  const getTimeSeconds = (ts) => {
    if (!ts) return 0;
    if (typeof ts.seconds === "number") return ts.seconds;
    try {
      return Math.floor(new Date(ts).getTime() / 1000);
    } catch {
      return 0;
    }
  };

  const recentRegs = regs
    .slice()
    .sort(
      (a, b) => getTimeSeconds(b.registeredAt) - getTimeSeconds(a.registeredAt)
    );

  return (
    <section className="card">
      <div className="admin-header">
        <div>
          <h2>Admin Dashboard</h2>
          <p className="muted">
            Create and manage extracurricular activities for KL University.
          </p>
          {error && (
            <p style={{ color: "#f97373", fontSize: "0.8rem" }}>{error}</p>
          )}
        </div>
        <div className="admin-stats">
          <div className="stat-card">
            <span className="stat-label">Total Activities</span>
            <span className="stat-value">{activities.length}</span>
          </div>
          <div className="stat-card stat-secondary">
            <span className="stat-label">Total Registrations</span>
            <span className="stat-value">{totalRegs}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Students</span>
            <span className="stat-value">{students.length}</span>
          </div>
        </div>
      </div>

      <form className="form" onSubmit={handleAddActivity}>
        <div className="form-grid">
          <div className="form-field">
            <label>Activity title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hackathon, Club Orientation"
            />
          </div>

          <div className="form-field">
            <label>Type</label>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="Club">Club</option>
              <option value="Sports">Sports</option>
              <option value="Event">Event</option>
              <option value="Workshop">Workshop</option>
            </select>
          </div>

          <div className="form-field">
            <label>Date</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>Location</label>
            <input
              className="input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Seminar Hall, Ground"
            />
          </div>
        </div>

        <div className="form-field">
          <label>Description</label>
          <textarea
            className="input"
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of the activity"
          />
        </div>

        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? "Adding…" : "Add Activity"}
        </button>
      </form>

      <hr className="divider" />

      <div className="my-regs-header">
        <h3>All Activities</h3>
        <button className="btn secondary small" onClick={loadAllData}>
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading activities…</p>
      ) : activities.length === 0 ? (
        <p className="muted">No activities created yet.</p>
      ) : (
        <ul className="activity-list">
          {activities.map((act) => {
            const count = regCounts[act.id] || 0;
            return (
              <li key={act.id} className="activity-item">
                <div>
                  <div className="activity-title">
                    {act.title}
                    <span className="tag">{act.type}</span>
                  </div>
                  <p className="muted small">
                    {act.date || "Date not set"} · {act.location}
                  </p>
                  {act.description && (
                    <p className="small">{act.description}</p>
                  )}
                </div>
                <div className="small muted">
                  Participants:
                  <span style={{ marginLeft: 4, color: "#e5e7eb" }}>
                    {count}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <hr className="divider" />

      <h3>Recent Registrations</h3>
      {recentRegs.length === 0 ? (
        <p className="muted small">No registrations yet.</p>
      ) : (
        <ul className="activity-list">
          {recentRegs.slice(0, 6).map((r) => (
            <li key={r.id} className="activity-item">
              <div>
                <div className="activity-title">
                  {r.studentName} ({r.studentRoll})
                </div>
                <p className="muted small">
                  Activity:{" "}
                  {activityMap[r.activityId] || r.activityId || "Unknown"}
                </p>
              </div>
              <span className="small muted">{r.status || "Registered"}</span>
            </li>
          ))}
        </ul>
      )}

      <hr className="divider" />

      <h3>Registered Students</h3>
      {students.length === 0 ? (
        <p className="muted small">No students have logged in yet.</p>
      ) : (
        <ul className="activity-list">
          {students.map((s) => (
            <li key={s.id} className="activity-item">
              <div>
                <div className="activity-title">
                  {s.name || "Unnamed Student"}
                </div>
                <p className="muted small">{s.email}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ================= STUDENT PANEL ================= */

function StudentPanel() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [studentName, setStudentName] = useState("");
  const [studentRoll, setStudentRoll] = useState("");
  const [myRegs, setMyRegs] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [regError, setRegError] = useState("");

  const loadActivities = async () => {
    setLoading(true);
    setError("");
    try {
      const snap = await getDocs(collection(db, "activities"));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
      setActivities(list);
    } catch (err) {
      console.error("Error loading activities for student:", err);
      setError("Failed to load activities. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const register = async (activityId) => {
    if (!studentName.trim() || !studentRoll.trim()) {
      alert("Enter name & roll number first.");
      return;
    }
    try {
      await addDoc(collection(db, "registrations"), {
        activityId,
        studentName: studentName.trim(),
        studentRoll: studentRoll.trim(),
        status: "Registered",
        registeredAt: new Date(),
      });
      alert("Registration submitted! ✅");
    } catch (err) {
      console.error("Error registering:", err);
      alert("Failed to register: " + err.message);
    }
  };

  const loadMyRegs = async () => {
    if (!studentRoll.trim()) {
      alert("Enter roll number.");
      return;
    }
    setLoadingRegs(true);
    setRegError("");
    try {
      const q = query(
        collection(db, "registrations"),
        where("studentRoll", "==", studentRoll.trim())
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMyRegs(list);
    } catch (err) {
      console.error("Error loading registrations:", err);
      setRegError("Failed to load registrations.");
    } finally {
      setLoadingRegs(false);
    }
  };

  return (
    <section className="card">
      <div className="student-hero">
        <div>
          <h2>Student Activity Dashboard</h2>
          <p className="muted">
            Explore activities, register using your roll number and track your
            participation.
          </p>
          <div className="hero-badges-row">
            <span>🔥 Trending Events</span>
            <span>⭐ Certificates</span>
            <span>📣 Announcements</span>
          </div>
        </div>
      </div>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <div className="form-field">
          <label>Your name</label>
          <input
            className="input"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="e.g. OM PRAKHAR"
          />
        </div>
        <div className="form-field">
          <label>Roll number</label>
          <input
            className="input"
            value={studentRoll}
            onChange={(e) => setStudentRoll(e.target.value)}
            placeholder="24000XXXXX"
          />
        </div>
      </div>

      <hr className="divider" />

      <div className="my-regs-header">
        <h3>Available Activities</h3>
        <button className="btn secondary small" onClick={loadActivities}>
          Refresh
        </button>
      </div>

      {error && <p style={{ color: "#f97373", fontSize: "0.8rem" }}>{error}</p>}
      {loading ? (
        <p className="muted">Loading activities…</p>
      ) : activities.length === 0 ? (
        <p className="muted">No activities added yet.</p>
      ) : (
        <ul className="activity-list">
          {activities.map((a) => (
            <li key={a.id} className="activity-item">
              <div>
                <div className="activity-title">
                  {a.title}
                  <span className="tag">{a.type}</span>
                </div>
                <p className="muted small">
                  {a.date} · {a.location}
                </p>
                {a.description && (
                  <p className="small">{a.description}</p>
                )}
              </div>
              <button
                className="btn small primary"
                onClick={() => register(a.id)}
              >
                Register
              </button>
            </li>
          ))}
        </ul>
      )}

      <hr className="divider" />

      <div className="my-regs-header">
        <h3>My Participation</h3>
        <button className="btn secondary small" onClick={loadMyRegs}>
          Refresh
        </button>
      </div>

      {regError && (
        <p style={{ color: "#f97373", fontSize: "0.8rem" }}>{regError}</p>
      )}

      {loadingRegs ? (
        <p className="muted">Loading your registrations…</p>
      ) : myRegs.length === 0 ? (
        <p className="muted small">
          No registrations found for this roll number yet.
        </p>
      ) : (
        <ul className="activity-list">
          {myRegs.map((r) => (
            <li key={r.id} className="activity-item">
              <div>
                <p className="small">
                  Activity ID: <strong>{r.activityId}</strong>
                </p>
                <p className="muted small">Status: {r.status}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ✅ VERY IMPORTANT */
export default App;
