import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import TradeDetail from "./pages/TradeDetail";
import AddTrade from "./pages/AddTrade";
import ImportTrades from "./pages/ImportTrades";
import Reports from "./pages/Reports";
import Journal from "./pages/Journal";
import Sessions from "./pages/Sessions";
import Strategies from "./pages/Strategies";
import Instruments from "./pages/Instruments";
import Tags from "./pages/Tags";
import TradeCalendar from "./pages/TradeCalendar";
import PerformanceSummary from "./pages/PerformanceSummary";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trades"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Trades />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trades/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TradeDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trades/new"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AddTrade />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trades/import"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ImportTrades />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/journal"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Journal />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sessions"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Sessions />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/strategies"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Strategies />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/instruments"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Instruments />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/tags"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Tags />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TradeCalendar />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/performance"
              element={
                <ProtectedRoute>
                  <Layout>
                    <PerformanceSummary />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
