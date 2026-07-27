import { BOTTOM_TABS, Tab, TAB_GROUPS, TabId } from "../tabs";
import SteamWidget from "./SteamWidget";

interface SidebarProps {
  active: TabId;
  onSelect: (id: TabId) => void;
  expanded: boolean;
  onExpandedChange: (value: boolean) => void;
}

function Sidebar({ active, onSelect, expanded, onExpandedChange }: SidebarProps) {
  const renderItem = (tab: Tab) => (
    <li key={tab.id}>
      <button
        className={`sidebar-item${active === tab.id ? " active" : ""}`}
        onClick={() => onSelect(tab.id)}
      >
        <span className="sidebar-indicator" />
        <span className="sidebar-icon">{tab.icon}</span>
        <span className="sidebar-label">{tab.label}</span>
      </button>
    </li>
  );

  return (
    <div className="sidebar-rail collapsed">
      <nav
        className={`sidebar${expanded ? " peek" : " collapsed"}`}
        onMouseEnter={() => onExpandedChange(true)}
        onMouseLeave={() => onExpandedChange(false)}
      >
        <div className="sidebar-top">
          {TAB_GROUPS.map((group) => (
            <div className="sidebar-group" key={group.heading}>
              <span className="sidebar-heading">{group.heading}</span>
              <ul className="sidebar-list">{group.tabs.map(renderItem)}</ul>
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <SteamWidget collapsed={!expanded} />
          <ul className="sidebar-list">{BOTTOM_TABS.map(renderItem)}</ul>
        </div>
      </nav>
    </div>
  );
}

export default Sidebar;
