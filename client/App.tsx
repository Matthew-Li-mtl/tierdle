// The header that appears on every page, and which page to show for each URL.
import { Link, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.js';
import { ForgotPassword, ResetPassword, SignIn, SignUp } from './pages/AuthPages.js';
import Home from './pages/Home.js';

export default function App() {
  const { user, signOut } = useAuth();

  return (
    <>
      <header className="header">
        <Link to="/" className="logo">
          TIERDLE
        </Link>
        {user ? (
          <div className="header-user">
            <span>{user.username}</span>
            <button className="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/signin" className="button">
            Sign in
          </Link>
        )}
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
