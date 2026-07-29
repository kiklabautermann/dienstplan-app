import React, { useState, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import baseEvents from './events.json'
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import Login from "./Login";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Alle Events kommen nun aus Firestore
  const [events, setEvents] = useState([]);

  const eventCategories = [
    { label: "Frühschicht (1)", color: "#ef4444" },
    { label: "Spätschicht (2)", color: "#0ea5e9" },
    { label: "Nachtschicht", color: "#1e3a8a" },
    { label: "Frei", color: "#22c55e" },
    { label: "Ferien", color: "#22c55e" },
    { label: "Pikett (P)", color: "#f97316" },
    { label: "Privat / Event", color: "#a855f7" }
  ];

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [currentEvent, setCurrentEvent] = useState({ id: null, title: '', date: '', backgroundColor: '#a855f7', borderColor: '#a855f7' })

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

  const fetchEvents = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "events"));
      const eventsData = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      }));
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

  // Klick auf einen leeren Tag -> Neuen Termin anlegen
  const handleDateClick = (arg) => {
    setCurrentEvent({ id: null, title: '', date: arg.dateStr, backgroundColor: '#a855f7', borderColor: '#a855f7' })
    setModalOpen(true)
  }

  // Klick auf einen bestehenden Termin -> Bearbeiten/Löschen (jetzt für alle)
  const handleEventClick = (arg) => {
    setCurrentEvent({
      id: arg.event.id,
      title: arg.event.title,
      date: arg.event.startStr,
      backgroundColor: arg.event.backgroundColor,
      borderColor: arg.event.borderColor
    })
    setModalOpen(true)
  }

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
          borderColor: currentEvent.borderColor
        });
        
        // Lokalen State updaten (für sofortige Anzeige)
        setEvents(prev => prev.map(ev => ev.id === currentEvent.id ? { 
          ...ev, 
          title: currentEvent.title,
          backgroundColor: currentEvent.backgroundColor,
          borderColor: currentEvent.borderColor
        } : ev));
      } else {
        // Neues Event zu Firestore hinzufügen
        const docRef = await addDoc(collection(db, "events"), {
          title: currentEvent.title,
          date: currentEvent.date,
          backgroundColor: currentEvent.backgroundColor,
          borderColor: currentEvent.borderColor,
          allDay: true
        });

        // Lokalen State updaten
        setEvents(prev => [...prev, {
          id: docRef.id,
          title: currentEvent.title,
          date: currentEvent.date,
          backgroundColor: currentEvent.backgroundColor,
          borderColor: currentEvent.borderColor,
          allDay: true
        }]);
      }
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
      setEvents(prev => prev.filter(ev => ev.id !== currentEvent.id));
      setModalOpen(false)
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Fehler beim Löschen.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-5xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden relative">
        
        {/* Header */}
        <header className="bg-blue-900 text-white p-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Dienstplan Sandra Domienik</h1>
            <p className="text-blue-200 mt-2">August & September 2026</p>
          </div>
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
        </header>

        {/* Legend */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap gap-4 text-sm font-medium">
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-red-500"></span> Frühschicht (1)</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-sky-500"></span> Spätschicht (2)</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-blue-900"></span> Nachtschicht</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-green-500"></span> Frei / Ferien / Ko / WB</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-orange-500"></span> Pikett (P)</div>
          <div className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-purple-500"></span> Privat / Event</div>
        </div>

        {/* Database Seeder Button (Nur anzeigen wenn keine Events da sind) */}
        {events.length === 0 && (
          <div className="p-4 bg-yellow-50 border-b border-yellow-200 flex justify-center">
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
          <p className="text-sm text-gray-500 mb-4 italic">Tipp: Klicke auf einen beliebigen Termin, um ihn zu bearbeiten. Klicke auf einen leeren Tag, um einen neuen Termin hinzuzufügen.</p>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate="2026-08-01"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth'
            }}
            events={events}
            height="auto"
            firstDay={1}
            locale="de"
            buttonText={{
              today: 'Heute',
              month: 'Monat'
            }}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
          />
        </div>

        {/* Modal for Add/Edit Event */}
        {modalOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-blue-900 px-6 py-4">
                <h3 className="text-lg font-bold text-white">
                  {currentEvent.id ? 'Termin bearbeiten' : 'Neuen Termin hinzufügen'}
                </h3>
              </div>
              <form onSubmit={saveEvent} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
                  <input 
                    type="text" 
                    value={currentEvent.date} 
                    disabled 
                    className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 text-gray-600 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategorie / Farbe</label>
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
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-4"
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titel des Termins (optional anpassbar)</label>
                  <input 
                    type="text" 
                    autoFocus
                    required
                    value={currentEvent.title} 
                    onChange={e => setCurrentEvent({...currentEvent, title: e.target.value})}
                    placeholder="z.B. Ausflug an den See"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="pt-4 flex justify-between gap-3">
                  {currentEvent.id ? (
                    <button 
                      type="button" 
                      onClick={deleteEvent}
                      className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 font-medium rounded-lg transition-colors"
                    >
                      Löschen
                    </button>
                  ) : <div></div>}
                  
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium rounded-lg transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg transition-colors shadow-sm"
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
