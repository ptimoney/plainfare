import styles from "./Tag.module.css";

interface TagProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export function Tag({ children, active, onClick }: TagProps) {
  const cls = [styles.tag, active && styles.active, onClick && styles.clickable]
    .filter(Boolean)
    .join(" ");
  return <span className={cls} onClick={onClick}>{children}</span>;
}
