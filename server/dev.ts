// Runs the API on your own computer. Vercel does not use this file.
import app from './app.js';

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
