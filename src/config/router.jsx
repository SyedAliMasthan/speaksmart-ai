import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import LoadingScreen from '../components/common/LoadingScreen';
import ErrorBoundary from '../components/common/ErrorBoundary';

const LandingPage    = lazy(() => import('../pages/LandingPage'));
const LoginPage      = lazy(() => import('../pages/LoginPage'));
const SignupPage     = lazy(() => import('../pages/SignupPage'));
const Dashboard      = lazy(() => import('../pages/Dashboard'));
const Lessons        = lazy(() => import('../pages/Lessons'));
const Practice       = lazy(() => import('../pages/Practice'));
const Vocabulary     = lazy(() => import('../pages/Vocabulary'));
const Progress       = lazy(() => import('../pages/Progress'));
const Profile        = lazy(() => import('../pages/Profile'));
const Settings       = lazy(() => import('../pages/Settings'));
const TutorDashboard = lazy(() => import('../pages/TutorDashboard'));
const PrivacyPolicy  = lazy(() => import('../pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('../pages/TermsOfService'));
const NotFound       = lazy(() => import('../pages/NotFound'));

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function Public({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<Public><LandingPage /></Public>} />
              <Route path="/login" element={<Public><LoginPage /></Public>} />
              <Route path="/signup" element={<Public><SignupPage /></Public>} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
              <Route path="/lessons" element={<Protected><Lessons /></Protected>} />
              <Route path="/lessons/:lessonId" element={<Protected><Lessons /></Protected>} />
              <Route path="/practice" element={<Protected><Practice /></Protected>} />
              <Route path="/practice/:topic" element={<Protected><Practice /></Protected>} />
              <Route path="/vocabulary" element={<Protected><Vocabulary /></Protected>} />
              <Route path="/progress" element={<Protected><Progress /></Protected>} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="/settings" element={<Protected><Settings /></Protected>} />
              <Route path="/tutor" element={<Protected><TutorDashboard /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
