import { Link } from "react-router-dom";
import type { ModuleDefinition } from "../modules/registry";

interface ModuleHubProps {
  modules: ModuleDefinition[];
}

const statusCopy: Record<ModuleDefinition["maturity"], string> = {
  alpha: "Preview",
  beta: "Beta",
  stable: "Stable"
};

const ModuleHub = ({ modules }: ModuleHubProps) => {
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h2>Tools</h2>
          <p className="muted">One auth session, multiple workflows.</p>
        </div>
      </div>
      <div className="modules-grid">
        {modules.map((module) => (
          <Link key={module.id} to={module.path} className="module-card">
            <div>
              <p className="module-status">{statusCopy[module.maturity]}</p>
              <h3>{module.name}</h3>
              <p className="muted">{module.description}</p>
            </div>
            <div className="module-tags">
              {module.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default ModuleHub;
