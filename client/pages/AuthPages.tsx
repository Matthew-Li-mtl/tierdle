// The four account pages. They differ only in their fields and what happens on submit.
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Session } from '../../shared/types.js';
import { api } from '../api.js';
import { useAuth } from '../auth.js';

// Handles the parts every form shares: the title, the submit button, errors, and busy state.
function AuthForm(props: {
  title: string;
  submitLabel: string;
  onSubmit: () => Promise<void>;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); // stop the browser from reloading the page
    setError('');
    setBusy(true);
    try {
      await props.onSubmit();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h1>{props.title}</h1>
      {props.children}
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={busy}>
        {props.submitLabel}
      </button>
      {props.footer}
    </form>
  );
}

function Field(props: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="field">
      {props.label}
      <input
        type={props.type}
        value={props.value}
        autoComplete={props.autoComplete}
        onChange={(event) => props.onChange(event.target.value)}
        required
      />
    </label>
  );
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function submit() {
    signIn(await api<Session>('/auth/signin', 'POST', { email, password }));
    navigate('/');
  }

  return (
    <AuthForm
      title="Sign in"
      submitLabel="Sign in"
      onSubmit={submit}
      footer={
        <p>
          <Link to="/signup">Create an account</Link> · <Link to="/forgot-password">Forgot password?</Link>
        </p>
      }
    >
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
    </AuthForm>
  );
}

export function SignUp() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function submit() {
    signIn(await api<Session>('/auth/signup', 'POST', { email, username, password }));
    navigate('/');
  }

  return (
    <AuthForm
      title="Create an account"
      submitLabel="Sign up"
      onSubmit={submit}
      footer={
        <p>
          <Link to="/signin">Already have an account?</Link>
        </p>
      }
    >
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field label="Username (shown publicly)" type="text" value={username} onChange={setUsername} autoComplete="username" />
      <Field label="Password (at least 8 characters)" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
    </AuthForm>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function submit() {
    await api('/auth/forgot-password', 'POST', { email });
    setSent(true);
  }

  if (sent) return <p>If that email has an account, a reset link is on its way. It expires in 1 hour.</p>;

  return (
    <AuthForm title="Reset your password" submitLabel="Send reset link" onSubmit={submit}>
      <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
    </AuthForm>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    await api('/auth/reset-password', 'POST', { token: params.get('token'), password });
    setDone(true);
  }

  if (done) {
    return (
      <p>
        Your password has been changed. <Link to="/signin">Sign in</Link>
      </p>
    );
  }

  return (
    <AuthForm title="Choose a new password" submitLabel="Change password" onSubmit={submit}>
      <Field label="New password (at least 8 characters)" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
    </AuthForm>
  );
}
