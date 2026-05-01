import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Discover from "./pages/Discover";
import Circles from "./pages/Circles";
import Peer from "./pages/Peer";
import CalendarPage from "./pages/CalendarPage";
import Brain from "./pages/Brain";
import Settings from "./pages/Settings";
import TutorProfile from "./pages/TutorProfile";
import SessionRoom from "./pages/SessionRoom";
import PaymentPage from "./pages/PaymentPage";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import DashboardRouter from "./pages/DashboardRouter";
import StudentDashboard from "./pages/dashboard/StudentDashboard";
import ParentDashboard from "./pages/dashboard/ParentDashboard";
import TutorDashboard from "./pages/dashboard/TutorDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import Profile from "./pages/Profile";
import ChildKnowledge from "./pages/parent/ChildKnowledge";
import ChildDiagnostic from "./pages/parent/ChildDiagnostic";
import Diagnose from "./pages/Diagnose";
import LearningPlan from "./pages/LearningPlan";
import Checkpoint from "./pages/Checkpoint";
import ExpertReview from "./pages/ExpertReview";
import { SchoolDashboard, CompanyDashboard } from "./pages/dashboard/OrgDashboard";
import OrgInviteAccept from "./pages/OrgInviteAccept";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
            <Route path="/dashboard/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/parent" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
            <Route path="/parent/children/:childId/knowledge" element={<ProtectedRoute><ChildKnowledge /></ProtectedRoute>} />
            <Route path="/parent/children/:childId/diagnostic" element={<ProtectedRoute><ChildDiagnostic /></ProtectedRoute>} />
            <Route path="/diagnose" element={<ProtectedRoute><Diagnose /></ProtectedRoute>} />
            <Route path="/parent/children/:childId/diagnose" element={<ProtectedRoute><Diagnose /></ProtectedRoute>} />
            <Route path="/plans/:planId" element={<ProtectedRoute><LearningPlan /></ProtectedRoute>} />
            <Route path="/checkpoints/:checkpointId" element={<ProtectedRoute><Checkpoint /></ProtectedRoute>} />
            <Route path="/expert/reviews/:reviewId" element={<ProtectedRoute><ExpertReview /></ProtectedRoute>} />
            <Route path="/dashboard/tutor" element={<ProtectedRoute><TutorDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/school" element={<ProtectedRoute><SchoolDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/company" element={<ProtectedRoute><CompanyDashboard /></ProtectedRoute>} />
            <Route path="/org/invite/:token" element={<ProtectedRoute><OrgInviteAccept /></ProtectedRoute>} />
            <Route path="/dashboard/legacy" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
            <Route path="/circles" element={<ProtectedRoute><Circles /></ProtectedRoute>} />
            <Route path="/peer" element={<ProtectedRoute><Peer /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            <Route path="/brain" element={<ProtectedRoute><Brain /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/tutor/:id" element={<ProtectedRoute><TutorProfile /></ProtectedRoute>} />
            <Route path="/session/:id" element={<ProtectedRoute><SessionRoom /></ProtectedRoute>} />
            <Route path="/payment/:bookingId" element={<ProtectedRoute><PaymentPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
