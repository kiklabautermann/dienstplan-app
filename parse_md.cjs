const fs = require('fs');

const mdContent = fs.readFileSync('../Sandra_Domienik_Kalendereintraege.md', 'utf8');
const lines = mdContent.split('\n');

const events = [];

let currentYear = '2026';
let currentMonth = '';

lines.forEach(line => {
  if (line.includes('|') && !line.includes('Datum')) {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 4) {
      const dateStr = parts[1];
      const entry = parts[3];

      if (dateStr && dateStr.match(/^\d{2}\.\d{2}\.\d{4}$/)) {
        const [day, month, year] = dateStr.split('.');
        const dateIso = `${year}-${month}-${day}`;
        
        let title = entry.replace(/\*/g, '').trim();
        let color = '#3b82f6'; // default blue
        
        if (title.toLowerCase().includes('frei') || title.toLowerCase() === 'w' || title.includes('Ferien') || title.toLowerCase().includes('ko')) {
          color = '#22c55e'; // green
          if(title === 'w') title = 'Weiterbildung';
          if(title.toLowerCase().includes('frei')) title = 'Frei';
          if(title.toLowerCase().includes('ko')) title = 'Kompensation (Ko)';
        } else if (title.includes('Nachtschicht') || title.includes('🌖')) {
          color = '#1e3a8a'; // dark blue
          title = 'Nachtschicht';
        } else if (title === '1') {
          color = '#ef4444'; // red (Früh)
          title = 'Frühschicht (1)';
        } else if (title === '2') {
          color = '#0ea5e9'; // light blue (Spät)
          title = 'Spätschicht (2)';
        } else if (title.startsWith('P')) {
          color = '#f97316'; // orange
        }

        events.push({
          title: title,
          date: dateIso,
          backgroundColor: color,
          borderColor: color,
          allDay: true
        });
      }
    }
  }
});

// Zusätzliche private Termine
events.push({
  title: 'Kenny Lakritze Konzert',
  date: '2026-08-05',
  backgroundColor: '#a855f7', // Tailwind purple-500
  borderColor: '#a855f7',
  allDay: true
});

fs.writeFileSync('./src/events.json', JSON.stringify(events, null, 2));
console.log('events.json written.');
