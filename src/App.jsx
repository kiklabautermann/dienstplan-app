import React, { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import baseEvents from './events.json'
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./Login";

function renderCommentWithLinks(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a 
          key={index} 
          href={part} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:text-blue-800 underline break-all font-medium"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Alle Events kommen nun aus Firestore
  const [events, setEvents] = useState([]);
  const [shareCopied, setShareCopied] = useState(false);
  
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [darkMode]);

  const eventCategories = [
    { label: "Frühschicht (1)", color: "#ef4444" },
    { label: "Spätschicht (2)", color: "#0ea5e9" },
    { label: "Nachtschicht", color: "#1e3a8a" },
    { label: "Frei", color: "#22c55e" },
    { label: "Ferien", color: "#22c55e" },
    { label: "Ferien Manuel", color: "#10b981" },
    { label: "Pikett (P)", color: "#f97316" },
    { label: "Privat / Event", color: "#a855f7" }
  ];

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [currentEvent, setCurrentEvent] = useState({ id: null, title: '', date: '', backgroundColor: '#a855f7', borderColor: '#a855f7', comment: '', recurrence: 'none', emoji: '' })

  const [weatherData, setWeatherData] = useState({});
  const [stampMode, setStampMode] = useState(null); // Speichert die ausgewählte Kategorie für den Quick-Add Modus
  const [showQuickAdd, setShowQuickAdd] = useState(false); // Toggle für die Quick-Add Leiste

  // View Tracker für Statistik
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Wetter API (Open-Meteo) für die nächsten 6 Tage
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // Koordinaten (4310 Rheinfelden, Schweiz)
        const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=47.5546&longitude=7.7925&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=6");
        const data = await res.json();
        
        if (data && data.daily) {
          const wData = {};
          data.daily.time.forEach((dateStr, index) => {
            const code = data.daily.weather_code[index];
            const max = Math.round(data.daily.temperature_2m_max[index]);
            const min = Math.round(data.daily.temperature_2m_min[index]);
            
            let icon = '🌤️'; // Standard: Heiter
            if (code === 0) icon = '☀️'; // Klar
            else if (code === 1 || code === 2) icon = '⛅'; // Bewölkt
            else if (code === 3) icon = '☁️'; // Stark bewölkt
            else if (code >= 45 && code <= 48) icon = '🌫️'; // Nebel
            else if (code >= 51 && code <= 55) icon = '🌧️'; // Nieselregen
            else if (code >= 61 && code <= 65) icon = '☔'; // Regen
            else if (code >= 71 && code <= 77) icon = '❄️'; // Schnee
            else if (code >= 95) icon = '⛈️'; // Gewitter

            wData[dateStr] = { icon, max, min };
          });
          setWeatherData(wData);
        }
      } catch (error) {
        console.error("Fehler beim Abrufen des Wetters:", error);
      }
    };
    fetchWeather();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchEvents();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // URL Deep Link Listener for shared events
  useEffect(() => {
    if (events.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const eventId = params.get('event');
      if (eventId) {
        const foundEvent = events.find(ev => ev.id === eventId);
        if (foundEvent) {
          setCurrentEvent({
            id: foundEvent.id,
            title: foundEvent.title,
            date: foundEvent.date || '',
            backgroundColor: foundEvent.backgroundColor,
            borderColor: foundEvent.borderColor,
            comment: foundEvent.comment || ''
          });
          setModalOpen(true);

          // Clear URL parameter cleanly
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    }
  }, [events]);

  const fetchEvents = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "events"));
      const eventsData = [];
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.recurrence && data.recurrence !== 'none') {
          // Basisdatum auslesen und zerlegen um Zeitzonen-Shifts zu vermeiden
          const parts = data.date.split('-');
          if (parts.length === 3) {
            const yyyy = parseInt(parts[0], 10);
            const mm = parseInt(parts[1], 10);
            const dd = parseInt(parts[2], 10);
            
            // 30 Vorkommnisse generieren
            for (let i = 0; i < 30; i++) {
              let d = new Date(yyyy, mm - 1, dd);
              if (data.recurrence === 'yearly') {
                d.setFullYear(yyyy + i);
              } else if (data.recurrence === 'monthly') {
                d.setMonth((mm - 1) + i);
              } else if (data.recurrence === 'weekly') {
                d.setDate(dd + (i * 7));
              }
              
              const resY = d.getFullYear();
              const resM = String(d.getMonth() + 1).padStart(2, '0');
              const resD = String(d.getDate()).padStart(2, '0');
              
              eventsData.push({
                ...data,
                id: `${doc.id}_${i}`,
                originalId: doc.id,
                date: `${resY}-${resM}-${resD}`
              });
            }
          } else {
             // Fallback falls Datum falsch formatiert ist
             eventsData.push({ ...data, id: doc.id, originalId: doc.id });
          }
        } else {
          eventsData.push({
            ...data,
            id: doc.id,
            originalId: doc.id
          });
        }
      });
      setEvents(eventsData);
    } catch (error) {
      console.error("Fehler beim Laden der Termine:", error);
    } finally {
      setLoading(false);
    }
  };

  const seedDatabase = async () => {
    if (window.confirm("Möchtest du den festen Dienstplan (aus der Datei) einmalig in die Datenbank importieren?")) {
      try {
        const batch = writeBatch(db);
        baseEvents.forEach(event => {
          const docRef = doc(collection(db, "events"));
          batch.set(docRef, {
            title: event.title,
            date: event.date,
            backgroundColor: event.backgroundColor,
            borderColor: event.borderColor,
            allDay: true
          });
        });
        await batch.commit();
        alert("Erfolgreich importiert!");
        fetchEvents();
      } catch (error) {
        console.error("Fehler beim Importieren:", error);
        alert("Fehler beim Importieren. Siehe Konsole.");
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Laden...</div>;
  }

  if (!user) {
    return <Login />;
  }

  // Klick auf einen leeren Tag -> Neuen Termin anlegen (oder stempeln)
  const handleDateClick = async (arg) => {
    if (stampMode) {
      try {
        await addDoc(collection(db, "events"), {
          title: stampMode.label,
          date: arg.dateStr,
          backgroundColor: stampMode.color,
          borderColor: stampMode.color,
          allDay: true,
          comment: '',
          recurrence: 'none',
          emoji: ''
        });
        await fetchEvents();
      } catch (error) {
        console.error("Fehler beim Quick-Add (Stempeln):", error);
        alert("Fehler beim Stempeln des Termins.");
      }
    } else {
      setCurrentEvent({ id: null, title: '', date: arg.dateStr, backgroundColor: '#a855f7', borderColor: '#a855f7', comment: '', recurrence: 'none', emoji: '' })
      setModalOpen(true)
    }
  }

  // Klick auf einen bestehenden Termin -> Bearbeiten/Löschen (jetzt für alle)
  const handleEventClick = (arg) => {
    if (arg.jsEvent.target.closest('.duplicate-btn')) {
      return; // Klick wurde vom Duplizieren-Button abgefangen
    }

    const origId = arg.event.extendedProps.originalId || arg.event.id;
    const isRecurring = arg.event.extendedProps.recurrence && arg.event.extendedProps.recurrence !== 'none';
    
    setCurrentEvent({
      id: origId,
      title: arg.event.title,
      // Bei wiederkehrenden Events zeigen wir zur Bearbeitung das Basisdatum an,
      // wenn gewünscht kann man hier auch arg.event.startStr nehmen (dann sieht man das angeklickte).
      // Da Änderungen aber für alle gelten, ist das ursprüngliche Startdatum sinnvoll.
      date: isRecurring && arg.event.extendedProps.date ? arg.event.extendedProps.date : arg.event.startStr,
      backgroundColor: arg.event.backgroundColor,
      borderColor: arg.event.borderColor,
      comment: arg.event.extendedProps.comment || '',
      recurrence: arg.event.extendedProps.recurrence || 'none',
      emoji: arg.event.extendedProps.emoji || ''
    })
    setModalOpen(true)
  }

  const handleDuplicate = async (eventProps) => {
    const dateStr = eventProps.startStr;
    if (!dateStr) return;

    const parts = dateStr.split('-');
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    
    const resY = d.getFullYear();
    const resM = String(d.getMonth() + 1).padStart(2, '0');
    const resD = String(d.getDate()).padStart(2, '0');
    const nextDayStr = `${resY}-${resM}-${resD}`;

    try {
      await addDoc(collection(db, "events"), {
        title: eventProps.title,
        date: nextDayStr,
        backgroundColor: eventProps.backgroundColor,
        borderColor: eventProps.borderColor,
        allDay: true,
        comment: eventProps.extendedProps.comment || '',
        recurrence: 'none', // Wir duplizieren als Einzeltermin
        emoji: eventProps.extendedProps.emoji || ''
      });
      await fetchEvents();
    } catch (error) {
      console.error("Fehler beim Duplizieren:", error);
      alert("Fehler beim Duplizieren.");
    }
  };

  const handleEventDrop = async (info) => {
    // Bei wiederkehrenden Terminen fragen wir sicherheitshalber nach, da Drag&Drop sonst
    // ggf. verwirrend ist (ändert es alle? ändert es nur einen?).
    // Für diesen Use-Case verbieten wir D&D für wiederkehrende Termine erst einmal.
    if (info.event.extendedProps.recurrence && info.event.extendedProps.recurrence !== 'none') {
      alert("Wiederkehrende Termine können momentan nicht per Drag & Drop verschoben werden. Bitte klicke den Termin an und bearbeite ihn.");
      info.revert();
      return;
    }

    const eventId = info.event.extendedProps.originalId || info.event.id;
    const newDateStr = info.event.startStr;

    try {
      const eventRef = doc(db, "events", eventId);
      await updateDoc(eventRef, {
        date: newDateStr
      });
      // Um sicherzugehen, dass unser lokaler State synchron bleibt, 
      // laden wir neu (ist ohnehin schnell, da klein).
      await fetchEvents();
    } catch (error) {
      console.error("Fehler beim Verschieben (Drag&Drop):", error);
      alert("Fehler beim Verschieben des Termins.");
      info.revert(); // Bei Fehler im UI zurücksetzen
    }
  };

  const saveEvent = async (e) => {
    e.preventDefault()
    if (!currentEvent.title.trim()) return

    try {
      if (currentEvent.id) {
        // Update bestehendes Event in Firestore
        const eventRef = doc(db, "events", currentEvent.id);
        await updateDoc(eventRef, {
          title: currentEvent.title,
          backgroundColor: currentEvent.backgroundColor,
          borderColor: currentEvent.borderColor,
          comment: currentEvent.comment || '',
          recurrence: currentEvent.recurrence || 'none',
          emoji: currentEvent.emoji || ''
        });
      } else {
        // Neues Event zu Firestore hinzufügen
        await addDoc(collection(db, "events"), {
          title: currentEvent.title,
          date: currentEvent.date,
          backgroundColor: currentEvent.backgroundColor,
          borderColor: currentEvent.borderColor,
          allDay: true,
          comment: currentEvent.comment || '',
          recurrence: currentEvent.recurrence || 'none',
          emoji: currentEvent.emoji || ''
        });
      }
      // Statt lokalem Map/Push laden wir einfach neu, um auch Wiederholungen korrekt zu generieren
      await fetchEvents();
      setModalOpen(false)
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern.");
    }
  }

  const deleteEvent = async () => {
    if (!currentEvent.id) return;
    try {
      await deleteDoc(doc(db, "events", currentEvent.id));
      await fetchEvents();
      setModalOpen(false)
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Fehler beim Löschen.");
    }
  }

  const getShareText = () => {
    let formattedDate = currentEvent.date;
    if (currentEvent.date) {
      const parts = currentEvent.date.split('-');
      if (parts.length === 3) {
        formattedDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
      }
    }

    const shareUrl = `${window.location.origin}${window.location.pathname}?event=${currentEvent.id}`;

    let text = `📅 *Sandra's Dienstplan-Termin*\n`;
    text += `------------------------------------\n`;
    text += `Datum: ${formattedDate}\n`;
    text += `Titel: ${currentEvent.title}\n`;
    if (currentEvent.comment) {
      text += `Kommentar:\n${currentEvent.comment}\n`;
    }
    text += `\nLink zum Termin: ${shareUrl}`;
    return text;
  };

  const handleShareThreema = () => {
    const text = getShareText();
    window.open(`https://threema.id/compose?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareEmail = () => {
    const subject = `Dienstplan-Termin: ${currentEvent.title}`;
    const body = getShareText();
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleShareSignal = () => {
    const text = getShareText();
    navigator.clipboard.writeText(text);
    alert("Der Termin-Text wurde in die Zwischenablage kopiert!\n\nSignal wird jetzt geöffnet, damit du den Text dort mit 'Einfügen' (Paste) versenden kannst.");
    window.open('sgnl://', '_blank');
  };

  const handleShareSystem = () => {
    if (navigator.share) {
      navigator.share({
        title: `Termin: ${currentEvent.title}`,
        text: getShareText()
      }).catch(err => console.log("Fehler beim Teilen:", err));
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getShareText());
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 3000);
  };

  const getDarkColor = (color) => {
    const map = {
      '#ef4444': '#fca5a5', // red-500 -> red-300
      '#0ea5e9': '#7dd3fc', // sky-500 -> sky-300
      '#1e3a8a': '#93c5fd', // blue-900 -> blue-300
      '#22c55e': '#86efac', // green-500 -> green-300
      '#10b981': '#6ee7b7', // emerald-500 -> emerald-300
      '#f97316': '#fdba74', // orange-500 -> orange-300
      '#a855f7': '#d8b4fe'  // purple-500 -> purple-300
    };
    return map[color] || color;
  };

  const displayEvents = events.map(ev => ({
    ...ev,
    originalColor: ev.backgroundColor, // Wichtig für's Speichern!
    backgroundColor: darkMode ? getDarkColor(ev.backgroundColor) : ev.backgroundColor,
    borderColor: darkMode ? getDarkColor(ev.borderColor) : ev.borderColor,
  }));

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8 transition-colors duration-200">
      <div className="max-w-5xl mx-auto bg-white dark:bg-gray-800 dark:border dark:border-gray-700 shadow-xl rounded-2xl overflow-hidden relative transition-colors duration-200">
        
        {/* Header */}
        <header className="bg-blue-900 dark:bg-gray-950 text-white p-6 flex justify-between items-center transition-colors duration-200">
          <div>
            <h1 className="text-3xl font-bold">Dienstplan Sandra</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-lg bg-blue-800 hover:bg-blue-700 dark:bg-gray-800 dark:hover:bg-gray-700 text-white font-semibold transition-colors flex items-center justify-center cursor-pointer shadow-sm text-lg"
              title={darkMode ? "Licht-Modus aktivieren" : "Dunkel-Modus aktivieren"}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button 
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ef4444', // Tailwind red-500
                color: 'white',
                borderRadius: '6px',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Legend */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex flex-wrap gap-4 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors duration-200 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            {eventCategories.map((cat, idx) => {
              // We skip "Ferien" since it shares the color with "Frei" and label includes it
              if (cat.label === "Ferien") return null; 
              
              const displayColor = darkMode ? getDarkColor(cat.color) : cat.color;
              let displayLabel = cat.label;
              if (cat.label === "Frei") displayLabel = "Frei / Ferien / Ko / WB";

              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full" style={{ backgroundColor: displayColor }}></span> {displayLabel}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => {
              if (showQuickAdd) setStampMode(null); // Modus beenden wenn eingeklappt wird
              setShowQuickAdd(!showQuickAdd);
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 dark:bg-blue-900/50 dark:hover:bg-blue-800 dark:text-blue-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-blue-200 dark:border-blue-700/50 ml-auto"
          >
            ⚡ Quick-Add {showQuickAdd ? 'ausblenden' : 'einblenden'}
          </button>
        </div>

        {/* Quick-Add Toolbar */}
        {showQuickAdd && (
          <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200 animate-fade-in-down">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-700 dark:text-gray-300">
              ⚡ Quick-Add (Stempel-Modus)
              {stampMode && <span className="text-xs font-normal bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full animate-pulse">Aktiv</span>}
            </h3>
            <div className="flex flex-wrap gap-2">
              {eventCategories.map((cat, idx) => {
                const isActive = stampMode?.label === cat.label;
                const displayColor = darkMode ? getDarkColor(cat.color) : cat.color;
                return (
                  <button
                    key={idx}
                    onClick={() => setStampMode(isActive ? null : cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer border ${isActive ? 'ring-2 ring-offset-1 dark:ring-offset-gray-800' : 'opacity-80 hover:opacity-100'}`}
                    style={{
                      backgroundColor: isActive ? displayColor : 'transparent',
                      color: isActive ? (darkMode ? '#111827' : 'white') : displayColor,
                      borderColor: displayColor,
                      boxShadow: isActive ? `0 0 0 2px ${displayColor}40` : 'none'
                    }}
                  >
                    {isActive ? `✓ ${cat.label} stempeln` : `+ ${cat.label}`}
                  </button>
                );
              })}
            </div>
            {stampMode && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Klicke nun auf beliebige Tage im Kalender, um "<strong>{stampMode.label}</strong>" sofort einzutragen. Klicke den Button oben erneut, um den Modus zu beenden.
              </p>
            )}
          </div>
        )}

        {/* Statistik Dashboard */}
        <div className="p-4 bg-indigo-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
          <h3 className="text-sm font-semibold mb-3 text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
            📊 Statistik für {new Date(currentYear, currentMonth).toLocaleString('de-CH', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex flex-wrap gap-3">
            {(() => {
              const currentMonthEvents = events.filter(ev => {
                if(!ev.date) return false;
                const [y, m] = ev.date.split('-');
                return parseInt(y) === currentYear && parseInt(m) - 1 === currentMonth;
              });

              const stats = {};
              eventCategories.forEach(cat => stats[cat.label] = 0);
              
              currentMonthEvents.forEach(ev => {
                const colorToMatch = ev.originalColor || ev.backgroundColor;
                const cat = eventCategories.find(c => c.color === colorToMatch);
                if (cat) {
                  stats[cat.label] = (stats[cat.label] || 0) + 1;
                } else {
                  stats['Andere'] = (stats['Andere'] || 0) + 1;
                }
              });

              // Nur Kategorien anzeigen, die > 0 sind (optional, aber übersichtlicher)
              return Object.entries(stats).map(([label, count], idx) => {
                if (count === 0) return null;
                const catInfo = eventCategories.find(c => c.label === label);
                const color = catInfo ? (darkMode ? getDarkColor(catInfo.color) : catInfo.color) : '#9ca3af'; // gray-400 als Fallback
                return (
                  <div key={idx} className="flex items-center gap-2 bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 shadow-sm">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}:</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white ml-1">{count}x</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Database Seeder Button (Nur anzeigen wenn keine Events da sind) */}
        {events.length === 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-b border-yellow-200 dark:border-yellow-900/50 flex justify-center text-yellow-800 dark:text-yellow-200 transition-colors duration-200">
             <button 
                onClick={seedDatabase}
                className="px-4 py-2 bg-yellow-500 text-white font-bold rounded shadow hover:bg-yellow-600"
             >
                Basis-Termine in die Datenbank importieren
             </button>
          </div>
        )}

        {/* Calendar */}
        <div className="p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 italic">Tipp: Klicke auf einen beliebigen Termin, um ihn zu bearbeiten. Klicke auf einen leeren Tag, um einen neuen Termin hinzuzufügen.</p>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate="2026-08-01"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth'
            }}
            events={displayEvents}
            height="auto"
            firstDay={1}
            locale="de"
            editable={true} // Drag & Drop aktivieren
            droppable={true}
            eventDrop={handleEventDrop}
            datesSet={(dateInfo) => {
              setCurrentMonth(dateInfo.view.currentStart.getMonth());
              setCurrentYear(dateInfo.view.currentStart.getFullYear());
            }}
            buttonText={{
              today: 'Heute',
              month: 'Monat'
            }}
            dayCellClassNames={(arg) => {
              const y = arg.date.getFullYear();
              const m = String(arg.date.getMonth() + 1).padStart(2, '0');
              const d = String(arg.date.getDate()).padStart(2, '0');
              const dateStr = `${y}-${m}-${d}`;
              
              const hasManuelFerien = events.some(ev => ev.date === dateStr && ev.backgroundColor === '#10b981');
              return hasManuelFerien ? ['manuel-ferien-bg'] : [];
            }}
            dayCellContent={(arg) => {
              const y = arg.date.getFullYear();
              const m = String(arg.date.getMonth() + 1).padStart(2, '0');
              const d = String(arg.date.getDate()).padStart(2, '0');
              const dateKey = `${y}-${m}-${d}`;
              
              const weather = weatherData[dateKey];
              
              return (
                <div className="flex justify-between items-start w-full px-1 pt-1 box-border">
                  <div className="flex-shrink-0">
                    {weather && (
                      <div 
                        className="flex items-center bg-transparent sm:bg-white sm:dark:bg-gray-800 sm:border border-gray-200 dark:border-gray-600 sm:shadow-sm rounded sm:px-1 py-0.5" 
                        title={`Max: ${weather.max}°C, Min: ${weather.min}°C`}
                      >
                        <span className="text-xs sm:text-sm leading-none">{weather.icon}</span>
                        <span className="hidden sm:flex flex-col text-[9px] font-bold leading-none ml-1">
                          <span className="text-red-500">{weather.max}°</span>
                          <span className="text-blue-500">{weather.min}°</span>
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Die Standardklasse fc-daygrid-day-number ist wichtig, damit unser CSS für 'Heute' greift */}
                  <div className="fc-daygrid-day-number flex-shrink-0 leading-none">
                    {arg.dayNumberText}
                  </div>
                </div>
              );
            }}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            eventContent={(eventInfo) => {
              const hasComment = eventInfo.event.extendedProps.comment;
              const emoji = eventInfo.event.extendedProps.emoji;
              return (
                <div className={`group relative flex items-center gap-1 overflow-hidden w-full px-1 ${darkMode ? 'text-gray-900' : 'text-white'}`}>
                  {hasComment && (
                    <span className="text-[10px] flex-shrink-0" title="Kommentar vorhanden">💬</span>
                  )}
                  <span className="truncate text-xs font-semibold pr-4">
                    {emoji && <span className="mr-1">{emoji}</span>}
                    {eventInfo.event.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDuplicate(eventInfo.event);
                    }}
                    className={`duplicate-btn absolute right-0 top-0 bottom-0 ${darkMode ? 'bg-white/40 hover:bg-white/60' : 'bg-black/40 hover:bg-black/60'} px-1.5 flex items-center justify-center cursor-pointer rounded-r`}
                    title="Auf nächsten Tag duplizieren"
                  >
                    +
                  </button>
                </div>
              );
            }}
          />
        </div>

        {/* Modal for Add/Edit Event */}
        {modalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden transition-colors duration-200">
              <div className="bg-blue-900 dark:bg-gray-950 px-6 py-4 transition-colors duration-200">
                <h3 className="text-lg font-bold text-white">
                  {currentEvent.id ? 'Termin bearbeiten' : 'Neuen Termin hinzufügen'}
                </h3>
              </div>
              <form onSubmit={saveEvent} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum</label>
                  <input 
                    type="text" 
                    value={currentEvent.date} 
                    disabled 
                    className="w-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-gray-600 dark:text-gray-300 cursor-not-allowed transition-colors duration-200"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategorie / Farbe</label>
                    <select 
                      value={currentEvent.backgroundColor}
                      onChange={(e) => {
                        const selectedColor = e.target.value;
                        const selectedCat = eventCategories.find(c => c.color === selectedColor);
                        setCurrentEvent({
                          ...currentEvent, 
                          backgroundColor: selectedColor, 
                          borderColor: selectedColor,
                          // Wenn der Titel leer ist oder einem anderen Standard-Titel entspricht, ändern wir ihn passend zur Kategorie mit.
                          title: (!currentEvent.title || eventCategories.some(c => c.label === currentEvent.title)) ? selectedCat.label : currentEvent.title
                        });
                      }}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none transition-colors duration-200"
                    >
                      {eventCategories.map((cat, idx) => (
                        <option key={idx} value={cat.color}>
                          {cat.label}
                        </option>
                      ))}
                      {/* Fallback für alte Termine mit anderen Farben */}
                      {!eventCategories.find(c => c.color === currentEvent.backgroundColor) && (
                         <option value={currentEvent.backgroundColor}>Andere ({currentEvent.backgroundColor})</option>
                      )}
                    </select>
                  </div>
                  {currentEvent.backgroundColor === '#a855f7' && (
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wiederholung</label>
                      <select 
                        value={currentEvent.recurrence}
                        onChange={(e) => setCurrentEvent({ ...currentEvent, recurrence: e.target.value })}
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none transition-colors duration-200"
                      >
                        <option value="none">Keine Wiederholung</option>
                        <option value="weekly">Wöchentlich</option>
                        <option value="monthly">Monatlich</option>
                        <option value="yearly">Jährlich</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Titel des Termins (optional)</label>
                    <input 
                      type="text" 
                      autoFocus
                      required
                      value={currentEvent.title} 
                      onChange={e => setCurrentEvent({...currentEvent, title: e.target.value})}
                      placeholder="z.B. Ausflug an den See"
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none transition-colors duration-200"
                    />
                  </div>
                  <div className="w-1/3 min-w-[120px]">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emoji</label>
                    <select
                      value={currentEvent.emoji || ''}
                      onChange={(e) => setCurrentEvent({ ...currentEvent, emoji: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white outline-none transition-colors duration-200"
                    >
                      <option value="">🚫 Kein</option>
                      <option value="🎂">🎂 Geburtstag</option>
                      <option value="🎉">🎉 Party</option>
                      <option value="🏖️">🏖️ Urlaub</option>
                      <option value="✈️">✈️ Flug/Reise</option>
                      <option value="🚗">🚗 Auto</option>
                      <option value="🩺">🩺 Arzt</option>
                      <option value="💇">💇 Friseur</option>
                      <option value="🎬">🎬 Kino/Film</option>
                      <option value="🎵">🎵 Konzert</option>
                      <option value="🎮">🎮 Gaming</option>
                      <option value="🍽️">🍽️ Essen</option>
                      <option value="🥂">🥂 Feier</option>
                      <option value="⚽">⚽ Sport</option>
                      <option value="🏃">🏃 Fitness</option>
                      <option value="🧘">🧘 Entspannung</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kommentar / Details</label>
                  <textarea 
                    value={currentEvent.comment || ''} 
                    onChange={e => setCurrentEvent({...currentEvent, comment: e.target.value})}
                    placeholder="Trage hier zusätzliche Notizen, Details oder Links (z.B. https://google.com) ein..."
                    rows={4}
                    className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-y text-sm transition-colors duration-200"
                  />
                </div>
                {currentEvent.comment && (
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm transition-colors duration-200">
                    <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Klickbare Links & Vorschau:</span>
                    <div className="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-200">
                      {renderCommentWithLinks(currentEvent.comment)}
                    </div>
                  </div>
                )}
                {/* Termin teilen (nur für bestehende Termine sinnvoll) */}
                {currentEvent.id && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-2">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Termin teilen</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleShareThreema}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        💬 Threema
                      </button>
                      <button
                        type="button"
                        onClick={handleShareSignal}
                        className="flex items-center gap-1 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        🔵 Signal
                      </button>
                      <button
                        type="button"
                        onClick={handleShareEmail}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        ✉️ E-Mail
                      </button>
                      {navigator.share && (
                        <button
                          type="button"
                          onClick={handleShareSystem}
                          className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        >
                          📱 Teilen
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleCopyText}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors border border-gray-300 dark:border-gray-600 cursor-pointer"
                      >
                        📋 Kopieren
                      </button>
                    </div>
                    {shareCopied && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium block mt-1">✓ Text in die Zwischenablage kopiert!</span>
                    )}
                  </div>
                )}
                <div className="pt-4 flex justify-between gap-3">
                  {currentEvent.id ? (
                    <button 
                      type="button" 
                      onClick={deleteEvent}
                      className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-900/30 border border-transparent dark:border-red-900/50 font-medium rounded-lg transition-colors cursor-pointer"
                    >
                      Löschen
                    </button>
                  ) : <div></div>}
                  
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium border border-gray-300 dark:border-gray-600 cursor-pointer"
                    >
                      Abbrechen
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg transition-colors shadow-sm cursor-pointer"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default App
