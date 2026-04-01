import styles from "./Alert.module.css";

interface AlertProps {
  variant: "success" | "error" | "warning";
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function Alert({ variant, title, children, actions }: AlertProps) {
  return (
    <div className={`${styles.alert} ${styles[variant]}`}>
      {title && <div className={styles.title}>{title}</div>}
      <div className={styles.body}>{children}</div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
