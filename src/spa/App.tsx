import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Providers } from "./components/providers";
import { AuthProvider } from "./lib/auth";
import { isDemoEnv } from "./lib/environment";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import StudentsPage from "./pages/StudentsPage";
import TeachersPage from "./pages/TeachersPage";
import ClassesPage from "./pages/ClassesPage";
import SubjectsPage from "./pages/SubjectsPage";
import GradesPage from "./pages/GradesPage";
import OcrGradesPage from "./pages/OcrGradesPage";
import AttendancePage from "./pages/AttendancePage";
import PaymentsPage from "./pages/PaymentsPage";
import RankingPage from "./pages/RankingPage";
import BulletinsPage from "./pages/BulletinsPage";
import TimetablePage from "./pages/TimetablePage";
import ReportsPage from "./pages/ReportsPage";
import IaAnalysisPage from "./pages/IaAnalysisPage";
import QrCenterPage from "./pages/QrCenterPage";
import ScannerPage from "./pages/ScannerPage";
import QrAttendancePage from "./pages/QrAttendancePage";
import DocumentStudioPage from "./pages/DocumentStudioPage";
import StudentCardsPage from "./pages/StudentCardsPage";
import PrintCenterPage from "./pages/PrintCenterPage";
import DocumentsPage from "./pages/DocumentsPage";
import CommunicationPage from "./pages/CommunicationPage";
import AssignmentsPage from "./pages/AssignmentsPage";
import CalendarPage from "./pages/CalendarPage";
import EstablishmentsPage from "./pages/EstablishmentsPage";
import AccessPage from "./pages/AccessPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Providers>
      <AuthProvider>
        <BrowserRouter basename={isDemoEnv() ? "/demo" : "/"}>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/teachers" element={<TeachersPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/subjects" element={<SubjectsPage />} />
              <Route path="/grades" element={<GradesPage />} />
              <Route path="/ocr-grades" element={<OcrGradesPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/ranking" element={<RankingPage />} />
              <Route path="/bulletins" element={<BulletinsPage />} />
              <Route path="/timetable" element={<TimetablePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/ia-analysis" element={<IaAnalysisPage />} />
              <Route path="/qr-center" element={<QrCenterPage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/qr-attendance" element={<QrAttendancePage />} />
              <Route path="/document-studio" element={<DocumentStudioPage />} />
              <Route path="/student-cards" element={<StudentCardsPage />} />
              <Route path="/print-center" element={<PrintCenterPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/communication" element={<CommunicationPage />} />
              <Route path="/assignments" element={<AssignmentsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/establishments" element={<EstablishmentsPage />} />
              <Route path="/access" element={<AccessPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </Providers>
  );
}
