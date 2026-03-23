/**
 * Local development server entry point.
 * For Vercel deployment, see api/index.ts which imports app.ts directly.
 */
import morgan from 'morgan';
import app from './app';

const PORT = parseInt(process.env.PORT || '3001', 10);

// Add request logging for local dev only
app.use(morgan('dev'));

app.listen(PORT, () => {
  console.log(`AquaVera backend running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
