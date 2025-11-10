import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  Outlet
} from "react-router-dom";
import TripListPage from "./pages/TripListPage";
import TripDetailPage from "./pages/TripDetailPage";
import { useMemo } from "react";
import ModuleHub from "./pages/ModuleHub";
import { modules } from "./modules/registry";
import { WorkspaceBadgeIcon } from "./components/icons/UtilityIcons";

const queryClient = new QueryClient();
const GroupExpensesModule = () => <Outlet />;

const App = () => {
  const authComponents = useMemo(
    () => ({
      SignIn: {
        Header() {
          return (
            <div className="auth-hero">
              <WorkspaceBadgeIcon className="auth-hero-icon" />
              <div>
                <h2>Utility Workspace</h2>
                <p>Single sign-on for every tool in the suite.</p>
              </div>
            </div>
          );
        }
      }
    }),
    []
  );

  const formFields = useMemo(
    () => ({
      signUp: {
        given_name: {
          order: 1,
          isRequired: true,
          label: "First name",
          placeholder: "Jane"
        },
        family_name: {
          order: 2,
          isRequired: true,
          label: "Last name",
          placeholder: "Smith"
        },
        email: {
          order: 3
        },
        password: {
          order: 4
        },
        confirm_password: {
          order: 5
        }
      }
    }),
    []
  );

  return (
    <Authenticator components={authComponents} formFields={formFields}>
      {({ user, signOut }) => {
        const fullName = [
          user?.attributes?.given_name,
          user?.attributes?.family_name
        ]
          .filter(Boolean)
          .join(" ");
        const displayName =
          fullName ||
          user?.attributes?.name ||
          user?.signInDetails?.loginId ||
          user?.username;

        return (
          <QueryClientProvider client={queryClient}>
            <BrowserRouter>
              <main className="app-container">
                <header className="app-header">
                  <div style={{ flex: 1 }}>
                    <h1>Personal Utility Platform</h1>
                    <p>Hi {displayName}</p>
                    <nav className="module-nav">
                      <NavLink
                        to="/"
                        className={({ isActive }) =>
                          isActive ? "module-link active" : "module-link"
                        }
                      >
                        All tools
                      </NavLink>
                      {modules.map((module) => (
                        <NavLink
                          key={module.id}
                          to={module.path}
                          className={({ isActive }) =>
                            isActive ? "module-link active" : "module-link"
                          }
                        >
                          {module.name}
                        </NavLink>
                      ))}
                    </nav>
                  </div>
                  <div className="header-actions">
                    <button className="secondary" onClick={() => signOut?.()}>
                      Sign Out
                    </button>
                  </div>
                </header>
                <Routes>
                  <Route path="/" element={<ModuleHub modules={modules} />} />
                  <Route path="/group-expenses" element={<GroupExpensesModule />}>
                    <Route index element={<Navigate to="trips" replace />} />
                    <Route path="trips" element={<TripListPage />} />
                    <Route path="trips/:tripId" element={<TripDetailPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </BrowserRouter>
          </QueryClientProvider>
        );
      }}
    </Authenticator>
  );
};

export default App;
