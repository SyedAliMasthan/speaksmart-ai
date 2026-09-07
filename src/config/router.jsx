import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import LoadingScreen from '../components/common/LoadingScreen';
import ErrorBoundary from '../components/common/ErrorBoundary';
const LandingPage = lazy(() => import('../pages/LandingPage'));
const AuthPage = lazy(() => import('../pages/AuthPage'));
const LearningPages = lazy(() => import('../pages/LearningPages'));
const Practice = lazy(() => import('../pages/Practice'));
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('../pages/TermsOfService'));
function Protected({ children }) {
  const { user, loading, error } = useAuth();
  if (loading) return <LoadingScreen />;
  if (error) return <main className="account-card"><p role="alert">{error}</p></main>;
  return user ? <div key={user.id}>{children}</div> : <Navigate to="/login" replace />;
}
export default function AppRouter() {
  return <BrowserRouter><AuthProvider><ErrorBoundary><Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/signup" element={<AuthPage mode="signup" />} />
    <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
    <Route path="/reset-password" element={<AuthPage mode="reset" />} />
    <Route path="/dashboard" element={<Protected><LearningPages page="dashboard" /></Protected>} />
    <Route path="/lessons" element={<Protected><LearningPages page="lessons" /></Protected>} />
    <Route path="/profile" element={<Protected><LearningPages page="profile" /></Protected>} />
    <Route path="/settings" element={<Protected><LearningPages page="profile" /></Protected>} />
    <Route path="/practice/:topic" element={<Protected><Practice /></Protected>} />
    <Route path="/practice" element={<Navigate to="/practice/introduce-yourself" replace />} />
    <Route path="/chat" element={<Navigate to="/practice/introduce-yourself" replace />} />
    <Route path="/progress" element={<Navigate to="/dashboard" replace />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="*" element={<main className="account-card"><h1>Page not found</h1><a href="/">Back to home</a></main>} />
  </Routes></Suspense></ErrorBoundary></AuthProvider></BrowserRouter>;
}
