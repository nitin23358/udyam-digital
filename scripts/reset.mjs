// Clears demo journeys, orders, consents and follow-ups (the CSV data is untouched).
import fs from 'fs';
const f = new URL('../server/udyam.sqlite', import.meta.url);
if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('Demo database removed. Restart the server for a clean slate.'); }
else console.log('Nothing to reset.');
