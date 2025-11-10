import { Link } from "react-router-dom";
import type { ModuleDefinition } from "../modules/registry";
import {
  AutomationSparkIcon,
  ToolStackIcon,
  WorkspaceBadgeIcon
} from "../components/icons/UtilityIcons";

interface ModuleHubProps {
  modules: ModuleDefinition[];
}

const statusCopy: Record<ModuleDefinition["maturity"], string> = {
  alpha: "Preview",
  beta: "Beta",
  stable: "Stable"
};

const heroIcons = [WorkspaceBadgeIcon, ToolStackIcon, AutomationSparkIcon];

const ModuleHub = ({ modules }: ModuleHubProps) => {
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <h2>Tools</h2>
          <p className="muted">One auth session, multiple workflows.</p>
        </div>
        <div className="platform-icon-row">
          {heroIcons.map((Icon, index) => (
            <Icon key={index} className="platform-icon" />
          ))}
        </div>
      </div>
      <div className="modules-grid">
        {modules.map((module) => (
          <Link key={module.id} to={module.path} className="module-card">
            <div className="module-card-top">
              {module.icon && <div className="module-icon">{module.icon}</div>}
              <div>
                <p className="module-status">{statusCopy[module.maturity]}</p>
                <h3>{module.name}</h3>
                <p className="muted">{module.description}</p>
              </div>
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
