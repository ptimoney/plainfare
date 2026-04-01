import styles from "./Tabs.module.css";

interface Tab {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className={styles.tabBar}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`${styles.tab} ${active === tab.key ? styles.active : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
