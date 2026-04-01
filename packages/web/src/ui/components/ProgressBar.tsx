import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
