import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ActiveRoleProvider } from "@/contexts/ActiveRoleContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ParentRouteGuard } from "@/components/auth/ParentRouteGuard";
import { FeatureRouteGuard } from "@/components/auth/FeatureRouteGuard";
import { RoleGate } from "@/components/auth/RoleGate";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Discover from "./pages/Discover";
import Circles from "./pages/Circles";
import Peer from "./pages/Peer";
import CalendarPage from "./pages/CalendarPage";
import Brain from "./pages/Brain";
import Settings from "./pages/Settings";
import TutorProfile from "./pages/TutorProfile";
import LiveLessonRoom from "./pages/LiveLessonRoom";
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
import LinkedStudentDashboard from "./pages/parent/LinkedStudentDashboard";
import Diagnose from "./pages/Diagnose";
import LearningPlan from "./pages/LearningPlan";
import Checkpoint from "./pages/Checkpoint";
import ExpertReview from "./pages/ExpertReview";
import { SchoolDashboard, CompanyDashboard } from "./pages/dashboard/OrgDashboard";
import OrgInviteAccept from "./pages/OrgInviteAccept";
import ResearchDashboard from "./pages/admin/ResearchDashboard";
import GrantPack from "./pages/admin/GrantPack";
import OperationalConsole from "./pages/admin/OperationalConsole";
import TutorVerification from "./pages/admin/TutorVerification";
import TutorOnboarding from "./pages/tutor/TutorOnboarding";
import TutorAvailability from "./pages/tutor/TutorAvailability";
import TutorPublicProfile from "./pages/tutor/TutorPublicProfile";
import BookSession from "./pages/booking/BookSession";
import GettingStarted from "./pages/GettingStarted";
import Notifications from "./pages/Notifications";
import Homework from "./pages/Homework";
import HomeworkDetail from "./pages/HomeworkDetail";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ActiveRoleProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<ProtectedRoute><ParentRouteGuard><Onboarding /></ParentRouteGuard></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRouter /></ProtectedRoute>} />
            <Route path="/getting-started" element={<ProtectedRoute><ParentRouteGuard><GettingStarted /></ParentRouteGuard></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/dashboard/student" element={<ProtectedRoute><ParentRouteGuard><StudentDashboard /></ParentRouteGuard></ProtectedRoute>} />
            <Route path="/dashboard/parent" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
            <Route path="/parent/children/:childId/knowledge" element={<ProtectedRoute><ChildKnowledge /></ProtectedRoute>} />
            <Route path="/parent/children/:childId/diagnostic" element={<ProtectedRoute><ChildDiagnostic /></ProtectedRoute>} />
            <Route path="/parent/linked/:studentId" element={<ProtectedRoute><LinkedStudentDashboard /></ProtectedRoute>} />
            <Route path="/diagnose" element={<ProtectedRoute><ParentRouteGuard><Diagnose /></ParentRouteGuard></ProtectedRoute>} />
            <Route path="/parent/children/:childId/diagnose" element={<ProtectedRoute><Diagnose /></ProtectedRoute>} />
            <Route path="/plans/:planId" element={<ProtectedRoute><LearningPlan /></ProtectedRoute>} />
            <Route path="/checkpoints/:checkpointId" element={<ProtectedRoute><Checkpoint /></ProtectedRoute>} />
            <Route path="/expert/reviews/:reviewId" element={<ProtectedRoute><ExpertReview /></ProtectedRoute>} />
            <Route path="/dashboard/tutor" element={<ProtectedRoute><ParentRouteGuard><TutorDashboard /></ParentRouteGuard></ProtectedRoute>} />
            <Route path="/dashboard/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/research" element={<ProtectedRoute><ResearchDashboard /></ProtectedRoute>} />
            <Route path="/admin/grant-pack" element={<ProtectedRoute><GrantPack /></ProtectedRoute>} />
            <Route path="/admin/operations" element={<ProtectedRoute><OperationalConsole /></ProtectedRoute>} />
            <Route path="/admin/tutors" element={<ProtectedRoute><FeatureRouteGuard feature="tutorMarketplace"><TutorVerification /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/tutor/onboarding" element={<ProtectedRoute><FeatureRouteGuard feature="tutorMarketplace"><ParentRouteGuard><TutorOnboarding /></ParentRouteGuard></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/tutor/availability" element={<ProtectedRoute><FeatureRouteGuard feature="booking"><ParentRouteGuard><TutorAvailability /></ParentRouteGuard></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/dashboard/school" element={<ProtectedRoute><SchoolDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/company" element={<ProtectedRoute><CompanyDashboard /></ProtectedRoute>} />
            <Route path="/org/invite/:token" element={<ProtectedRoute><OrgInviteAccept /></ProtectedRoute>} />
            <Route path="/dashboard/legacy" element={<ProtectedRoute><FeatureRouteGuard feature="booking" allowAdminPreview><Dashboard /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/discover" element={<ProtectedRoute><FeatureRouteGuard feature="tutorMarketplace"><ParentRouteGuard><Discover /></ParentRouteGuard></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/circles" element={<ProtectedRoute><FeatureRouteGuard feature="circles"><ParentRouteGuard><Circles /></ParentRouteGuard></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/peer" element={<ProtectedRoute><FeatureRouteGuard feature="peerHelp"><ParentRouteGuard><Peer /></ParentRouteGuard></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><FeatureRouteGuard feature="calendar"><CalendarPage /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/brain" element={<ProtectedRoute><FeatureRouteGuard feature="secondBrain"><Brain /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/tutor/:id" element={<ProtectedRoute><FeatureRouteGuard feature="tutorMarketplace"><TutorProfile /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/tutors/:tutorId" element={<ProtectedRoute><FeatureRouteGuard feature="tutorMarketplace"><TutorPublicProfile /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/book/:tutorId" element={<ProtectedRoute><FeatureRouteGuard feature="booking"><BookSession /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/session/:bookingId" element={<ProtectedRoute><FeatureRouteGuard feature="booking"><LiveLessonRoom /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/payment/:bookingId" element={<ProtectedRoute><ParentRouteGuard><PaymentPage /></ParentRouteGuard></ProtectedRoute>} />
            <Route path="/homework" element={<ProtectedRoute><FeatureRouteGuard feature="homework"><Homework /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="/homework/:id" element={<ProtectedRoute><FeatureRouteGuard feature="homework"><HomeworkDetail /></FeatureRouteGuard></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ActiveRoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
